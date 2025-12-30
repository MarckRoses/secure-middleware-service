/**
 * In-memory Circuit Breaker
 * 
 * States:
 * - CLOSED (Normal operation, failures count up)
 * - OPEN (Fail fast, return error immediately)
 * - HALF_OPEN (Optional: Try one request after cooldown)
 * 
 * Logic:
 * - 3 consecutive failures -> OPEN
 * - Cooldown: 30 seconds -> HALF_OPEN
 */

const STATE = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
};

const CONFIG = {
    FAILURE_THRESHOLD: 3,
    COOLDOWN_MS: 30000 // 30 seconds
};

class CircuitBreaker {
    constructor() {
        this.state = STATE.CLOSED;
        this.failCount = 0;
        this.nextAttempt = Date.now();
    }

    // Check if we can execute
    canExecute() {
        if (this.state === STATE.CLOSED) {
            return true;
        }

        if (this.state === STATE.OPEN) {
            if (Date.now() >= this.nextAttempt) {
                this.state = STATE.HALF_OPEN;
                return true; // Use this request as the probe
            }
            return false;
        }

        if (this.state === STATE.HALF_OPEN) {
            // If we are already half-open, we generally only allow ONE request at a time to probe.
            // For simplicity in this non-distributed demo, we'll assume the caller who triggered the state change gets to go.
            // But if multiple requests come in exactly at HALF_OPEN, we might want to reject the others.
            // For now, let's keep it simple: if HALF_OPEN, we proceed (assuming one probe). 
            // Strictly speaking, if we needed to serialize, we'd need a "probing" flag.
            // Let's just say yes for simplicity, subsequent failures will trip it back.
            return true;
        }
    }

    recordSuccess() {
        this.failCount = 0;
        this.state = STATE.CLOSED;
    }

    recordFailure() {
        if (this.state === STATE.HALF_OPEN) {
            // If we failed during half-open, go back to OPEN immediately, reset timer
            this.state = STATE.OPEN;
            this.nextAttempt = Date.now() + CONFIG.COOLDOWN_MS;
            return;
        }

        this.failCount++;
        if (this.failCount >= CONFIG.FAILURE_THRESHOLD) {
            this.state = STATE.OPEN;
            this.nextAttempt = Date.now() + CONFIG.COOLDOWN_MS;
        }
    }

    getState() {
        // If we are OPEN but past cooldown, we report OPEN even though next call will switch to HALF_OPEN.
        // Or we could proactively check time here. The requirement says "return fallback... while OPEN".
        // We update state lazily in `canExecute`.
        return {
            state: this.state,
            failCount: this.failCount
        };
    }
}

// Singleton instance for the app
const circuitBreaker = new CircuitBreaker();

module.exports = circuitBreaker;
