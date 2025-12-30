const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const sanitizer = require('../lib/sanitizer');
const cryptoLib = require('../lib/crypto');
const circuitBreaker = require('../lib/circuitBreaker');
const auditLog = require('../lib/auditLog');

/**
 * Mock AI Call
 * Simulates 2s delay.
 * Fails if `forceFail` is true.
 */
function mockAiCall(redactedMessage, forceFail) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (forceFail) {
                reject(new Error('AI Service Failed'));
            } else {
                resolve('Generated Answer.');
            }
        }, 2000);
    });
}

router.post('/secure-inquiry', async (req, res, next) => {
    try {
        const { userId, message } = req.body;

        // 1. Validation
        if (!userId || typeof userId !== 'string' || !userId.trim()) {
            return res.status(400).json({ error: 'userId is required and must be a non-empty string' });
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'message is required and must be a non-empty string' });
        }

        // 2. Circuit Breaker Check
        if (!circuitBreaker.canExecute()) {
            const state = circuitBreaker.getState();
            // Log the denial (optional, but good for audit)
            // Check if we need to audit denied requests. The prompt says "While OPEN... It must still perform Step 1 redaction and Step 3 audit logging"

            // Redaction
            const redactedMessage = sanitizer.sanitizeMessage(message);
            const encryptedMessage = cryptoLib.encrypt(message);

            const auditRecord = {
                id: uuidv4(),
                userId,
                createdAt: new Date().toISOString(),
                originalMessageEncrypted: encryptedMessage,
                redactedMessage: redactedMessage,
                aiResult: "Service Busy", // "Answer" or failure result
                circuitState: state.state
            };
            await auditLog.appendAuditRecord(auditRecord);

            return res.json({
                userId,
                redactedMessage,
                answer: "Service Busy",
                circuitBreaker: state
            });
        }

        // 3. Normal Flow
        const redactedMessage = sanitizer.sanitizeMessage(message);
        const encryptedMessage = cryptoLib.encrypt(message);

        // AI Call
        const forceFail = req.headers['x-mock-ai-fail'] === 'true';
        let aiAnswer;
        let errorOccurred = false;

        try {
            aiAnswer = await mockAiCall(redactedMessage, forceFail);
            circuitBreaker.recordSuccess();
        } catch (err) {
            errorOccurred = true;
            circuitBreaker.recordFailure();
            aiAnswer = "AI Service Error"; // Or expose the error? Prompt says "If request header... force the mock AI call to 'fail'". Doesn't explicitly say what to return to user on failure, but "Service Busy" is for Circuit Open.
            // Usually we return 500 or friendly error. Let's return the error message in the answer field or send 500.
            // Given the JSON response format: { userId, redactedMessage, "answer": "string", ... }
            // I'll populate "answer" with the error status or generic message.
        }

        // Capture state AFTER the operation (or before? Prompt: "Include state ... in the response". Usually current state.)
        const cbState = circuitBreaker.getState();

        const auditRecord = {
            id: uuidv4(),
            userId,
            createdAt: new Date().toISOString(),
            originalMessageEncrypted: encryptedMessage,
            redactedMessage: redactedMessage,
            aiResult: errorOccurred ? "Error: AI call failed" : aiAnswer,
            circuitState: cbState.state
        };

        await auditLog.appendAuditRecord(auditRecord);

        if (errorOccurred) {
            // If the AI call failed (and CB was closed), we probably still want to return 200 with error info 
            // OR 500. The prompt doesn't specify API status code for single failures, only for Invalid (400) and Closed CB (Service Busy).
            // I will return 200 but with error in answer to match the "friendly" vibe, or 503.
            // Let's stick to returning the JSON structure successfully but with an error indication in 'answer' or just throw.
            // Actually, if it throws, the user sees an error. 
            // Let's fail gracefully.
            return res.status(503).json({
                userId,
                redactedMessage,
                answer: "AI Service Unavailable",
                circuitBreaker: cbState
            });
        }

        // Success response
        return res.json({
            userId,
            redactedMessage,
            answer: aiAnswer,
            circuitBreaker: cbState
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
