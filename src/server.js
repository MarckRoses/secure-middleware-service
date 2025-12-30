require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cryptoLib = require('./lib/crypto'); // Check encryption key on startup
const secureInquiryRoutes = require('./routes/secureInquiry');

// Validate Environment
try {
    cryptoLib.getEncryptionKey();
} catch (err) {
    console.error("CRITICAL: Failed to start server.", err.message);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Logging Middleware (Basic, no sensitive data)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Routes
app.use('/', secureInquiryRoutes);

// Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Secure Middleware Service running on port ${PORT}`);
    console.log(`Encryption check passed.`);
});
