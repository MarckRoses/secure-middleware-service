const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize file if not exists
if (!fs.existsSync(AUDIT_FILE)) {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify([]));
}

// Simple in-memory queue to handle concurrent writes safely
let writeQueue = Promise.resolve();

/**
 * Appends an audit record to the JSON file.
 * @param {Object} record
 */
async function appendAuditRecord(record) {
    // Chain promises to sequentialize file writes
    writeQueue = writeQueue.then(async () => {
        try {
            // Read current content
            const fileContent = fs.readFileSync(AUDIT_FILE, 'utf8');
            let data = [];
            try {
                data = JSON.parse(fileContent);
            } catch (e) {
                // If corrupt, start fresh or handle error. defaulting to empty array.
                data = [];
            }

            // Append new record
            data.push(record);

            // Write back
            fs.writeFileSync(AUDIT_FILE, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Failed to write audit log:', err);
        }
    });

    return writeQueue;
}

module.exports = {
    appendAuditRecord
};
