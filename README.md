Secure Middleware Service

This service is responsible for providing secure middleware for the application.

Prompt: Build a Secure Middleware Service (Node.js + Express) with Redaction, Audit, and Circuit Breaker

You are a senior backend engineer. Generate a complete Node.js + Express project that implements a secure middleware API with redaction + encrypted audit logging + circuit breaker + Docker deployment.

1) API Endpoint

Create an endpoint:

POST /secure-inquiry

Accepts JSON body:

{ "userId": "string", "message": "string" }


Validation rules:

userId required, non-empty string

message required, non-empty string

If invalid → return 400 with a friendly JSON error

Response (success):

{
  "userId": "string",
  "redactedMessage": "string",
  "answer": "string",
  "circuitBreaker": { "state": "CLOSED|OPEN", "failCount": number }
}

2) Core Logic (must be implemented exactly in this order)
Step 1 — AI-Generated Sanitization (but implemented locally)

Implement a robust sanitizer that removes sensitive data from message and replaces it with tags in the format:

Emails → <REDACTED: EMAIL>

Credit cards → <REDACTED: CREDIT_CARD>

SSNs → <REDACTED: SSN> (treat as exactly 9 digits, optionally formatted like 123-45-6789, but also catch 123456789)

Requirements:

Use safe/defensive regex and avoid catastrophic backtracking

Preserve the rest of the message as-is

Redact multiple occurrences

Do not redact numbers that are not SSNs (e.g., 8 digits should not match)

Provide unit-test-like examples in comments (input → output)

Step 2 — Mock External AI Call (2 seconds)

Create a function mockAiCall(redactedMessage) that simulates an external AI call using setTimeout 2 seconds and returns:

"Generated Answer." on success

Also implement a controlled failure path:

If request header x-mock-ai-fail: true is present, force the mock AI call to “fail” (reject/throw) after the timeout.

Step 3 — Audit Log (encrypted original + plaintext redacted)

Write an audit record to a mock DB stored as a JSON file on disk (e.g., ./data/audit-log.json).

For each request, append an entry like:

{
  "id": "uuid",
  "userId": "string",
  "createdAt": "ISO8601",
  "originalMessageEncrypted": "base64...",
  "redactedMessage": "string",
  "aiResult": "string|error",
  "circuitState": "CLOSED|OPEN"
}


Encryption requirements:

Encrypt the original message using AES-256-GCM

The encryption key must come from environment variable AUDIT_ENCRYPTION_KEY

Use a random IV per record

Store { iv, ciphertext, authTag } combined into a single base64 string or a structured object (your choice, but be consistent)

If the key is missing → server should refuse to start with a clear error

File I/O requirements:

Ensure the data/ directory exists (create it if needed)

Handle concurrent writes safely (use a simple in-process mutex/queue)

Keep the JSON file as an array of entries

3) Circuit Breaker (the “Twist”)

Implement an in-memory circuit breaker around the mock AI call:

If the mock AI call fails 3 times in a row, the circuit becomes OPEN

While OPEN:

The API must immediately return a fallback response:

answer: "Service Busy"

It must not wait the 2 seconds timeout

It must still perform Step 1 redaction and Step 3 audit logging

Circuit breaker behavior:

Start in CLOSED state with failCount = 0

On success → reset failCount = 0 and keep CLOSED

On failure → failCount++; if failCount >= 3 → OPEN

Include state and failCount in the response

(Optional but preferred) Add a cool-down: after 30 seconds in OPEN, allow a single “half-open” attempt; if it succeeds → close/reset; if it fails → open again. If you implement HALF_OPEN, document it clearly.

4) Project Structure (must generate all files)

Use a clean structure like:

src/server.js (or src/index.js)

src/routes/secureInquiry.js

src/lib/sanitizer.js

src/lib/circuitBreaker.js

src/lib/auditLog.js

src/lib/crypto.js

data/ (created at runtime)

.env.example

package.json

Include:

Express + JSON body parsing

Basic request logging (no sensitive data in logs)

Centralized error handler returning JSON

5) Docker Deployment

Provide:

Dockerfile (production-ready)

docker-compose.yml that:

builds the service

maps port (e.g., 3000:3000)

mounts ./data as a volume for persistence

sets AUDIT_ENCRYPTION_KEY (use example placeholder; explain how to set securely)

6) Deliverable Format

Output:

A brief explanation of how it works

Then provide all project files with filenames and contents, ready to copy/paste

Include example curl commands:

normal success

forced failures using x-mock-ai-fail: true to trip the circuit breaker

Do not include any secrets—use placeholders only.

Make sure everything runs with:

docker compose up --build
and endpoint works immediately.