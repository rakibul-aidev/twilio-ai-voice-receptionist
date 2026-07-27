'use strict';

require('dotenv').config();

const express = require('express');
const twilio = require('twilio');
const voiceRouter = require('./routes/voice');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse URL-encoded bodies (Twilio sends webhooks as application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Validate that incoming requests are genuinely from Twilio
// Remove this middleware in local dev (ngrok) if you don't have a signature yet
if (process.env.NODE_ENV === 'production') {
  app.use('/voice', twilio.webhook({ authToken: process.env.TWILIO_AUTH_TOKEN }));
}

// Mount voice routes
app.use('/voice', voiceRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    business: process.env.BUSINESS_NAME || 'unconfigured',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🎙️  AI Voice Receptionist running on port ${PORT}`);
  console.log(`   Business: ${process.env.BUSINESS_NAME || '(not set)'}`);
  console.log(`   Inbound webhook: ${process.env.BASE_URL}/voice/inbound`);
  console.log(`   Status webhook:  ${process.env.BASE_URL}/voice/status\n`);
});

module.exports = app;
