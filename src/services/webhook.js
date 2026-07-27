'use strict';

const axios = require('axios');

/**
 * Post call summary to n8n / Make / Zapier webhook after the call ends.
 * The downstream workflow can update CRM, send email to staff, etc.
 */
async function postCallSummary(session, callMeta) {
  const url = process.env.POST_CALL_WEBHOOK_URL;
  if (!url) return; // Webhook not configured — skip silently

  const payload = {
    event: 'call_ended',
    timestamp: new Date().toISOString(),
    callSid: session.callSid,
    from: callMeta.from,
    duration: callMeta.duration,
    callerInfo: session.callerInfo,
    appointmentRequested: session.appointmentRequested,
    transferRequested: session.transferRequested,
    transcript: session.messages
      .map((m) => `${m.role === 'user' ? 'Caller' : 'Receptionist'}: ${m.content}`)
      .join('\n'),
    businessName: process.env.BUSINESS_NAME,
  };

  try {
    await axios.post(url, payload, { timeout: 5000 });
    console.log(`[webhook] Call summary posted for ${session.callSid}`);
  } catch (err) {
    console.error(`[webhook] Failed to post summary: ${err.message}`);
  }
}

/**
 * Send SMS confirmation to caller after appointment booked.
 */
async function sendSmsConfirmation(twilioClient, toNumber, appointmentDetails) {
  const businessName = process.env.BUSINESS_NAME || 'us';
  const message =
    `Hi ${appointmentDetails.name}, your appointment with ${businessName} ` +
    `is confirmed for ${appointmentDetails.date} at ${appointmentDetails.time}. ` +
    `Reason: ${appointmentDetails.reason}. Reply CANCEL to cancel. Thank you!`;

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toNumber,
    });
    console.log(`[sms] Confirmation sent to ${toNumber}`);
  } catch (err) {
    console.error(`[sms] Failed to send: ${err.message}`);
  }
}

module.exports = { postCallSummary, sendSmsConfirmation };
