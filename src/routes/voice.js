'use strict';

const express = require('express');
const twilio = require('twilio');
const { getReply } = require('../services/claude');
const { getSession, addMessage, updateCallerInfo, deleteSession } = require('../services/session');
const { postCallSummary, sendSmsConfirmation } = require('../services/webhook');

const router = express.Router();

// Twilio client (used for outbound SMS)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /voice/inbound
 * Called by Twilio when an inbound call arrives.
 * Plays a greeting and immediately opens the speech gather loop.
 */
router.post('/inbound', (req, res) => {
  const callSid = req.body.CallSid;
  const callerNumber = req.body.From;
  const businessName = process.env.BUSINESS_NAME || 'us';

  console.log(`[call] Inbound from ${callerNumber} — SID: ${callSid}`);

  // Initialise session with caller's phone number
  const session = getSession(callSid);
  updateCallerInfo(callSid, { phone: callerNumber });

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    `Thank you for calling ${businessName}. How can I help you today?`
  );

  // Gather: collect up to 10 seconds of speech, post to /voice/gather
  const gather = twiml.gather({
    input: 'speech',
    action: `${process.env.BASE_URL}/voice/gather`,
    method: 'POST',
    speechTimeout: 'auto',
    language: 'en-US',
    timeout: 10,
  });
  gather.say({ voice: 'Polly.Joanna' }, ''); // silence placeholder

  // If caller says nothing, prompt again
  twiml.redirect(`${process.env.BASE_URL}/voice/no-input`);

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/gather
 * Receives the caller's speech transcription from Twilio.
 * Sends it to Claude, plays the response, then gathers again (loop).
 */
router.post('/gather', async (req, res) => {
  const callSid = req.body.CallSid;
  const callerSpeech = req.body.SpeechResult || '';
  const callerNumber = req.body.From;

  console.log(`[caller] ${callerNumber}: "${callerSpeech}"`);

  const twiml = new twilio.twiml.VoiceResponse();

  if (!callerSpeech.trim()) {
    twiml.redirect(`${process.env.BASE_URL}/voice/no-input`);
    return res.type('text/xml').send(twiml.toString());
  }

  // Add caller turn to session history
  addMessage(callSid, 'user', callerSpeech);
  const session = getSession(callSid);

  let spokenText;
  let actions;

  try {
    ({ spokenText, actions } = await getReply(session.messages));
  } catch (err) {
    console.error(`[claude] Error: ${err.message}`);
    spokenText = "I'm sorry, I'm having a bit of trouble right now. Please hold while I connect you.";
    actions = { transferHuman: true, endCall: false, bookAppointment: null };
  }

  console.log(`[receptionist] ${spokenText}`);
  addMessage(callSid, 'assistant', spokenText);

  // Handle actions before playing response
  if (actions.bookAppointment) {
    session.appointmentRequested = true;
    updateCallerInfo(callSid, { name: actions.bookAppointment.name });

    // Send SMS confirmation (non-blocking)
    sendSmsConfirmation(twilioClient, callerNumber, actions.bookAppointment).catch(() => {});

    // Add confirmation to spoken text
    spokenText +=
      ` I've noted your appointment for ${actions.bookAppointment.date} at ${actions.bookAppointment.time}. ` +
      `You'll receive a text confirmation shortly.`;
  }

  // Speak Claude's response
  twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, spokenText);

  if (actions.transferHuman) {
    session.transferRequested = true;
    twiml.say({ voice: 'Polly.Joanna' }, 'Connecting you now. Please hold.');
    // Dial the business's real number
    twiml.dial(process.env.BUSINESS_PHONE || process.env.TWILIO_PHONE_NUMBER);

  } else if (actions.endCall) {
    twiml.say({ voice: 'Polly.Joanna' }, 'Have a wonderful day. Goodbye!');
    twiml.hangup();

  } else {
    // Continue conversation — gather next caller turn
    const gather = twiml.gather({
      input: 'speech',
      action: `${process.env.BASE_URL}/voice/gather`,
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US',
      timeout: 8,
    });
    gather.say({ voice: 'Polly.Joanna' }, '');
    twiml.redirect(`${process.env.BASE_URL}/voice/no-input`);
  }

  res.type('text/xml').send(twiml.toString());
});

/**
 * POST /voice/no-input
 * Caller said nothing — prompt once more then give up gracefully.
 */
router.post('/no-input', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: 'speech',
    action: `${process.env.BASE_URL}/voice/gather`,
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 8,
  });
  gather.say(
    { voice: 'Polly.Joanna' },
    "I didn't catch that. Feel free to speak, or press any key to repeat the menu."
  );
  twiml.say({ voice: 'Polly.Joanna' }, "I'll try again shortly. Please call back if needed. Goodbye!");
  twiml.hangup();

  res.type('text/xml').send(twiml.toString());
});

/**
 * POST /voice/status
 * Twilio calls this when the call ends (statusCallback).
 * Triggers the post-call webhook to update CRM / send email to staff.
 */
router.post('/status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callDuration = req.body.CallDuration;
  const callerNumber = req.body.From;

  const session = getSession(callSid);

  if (session && session.messages.length > 0) {
    await postCallSummary(session, { from: callerNumber, duration: callDuration });
  }

  deleteSession(callSid);
  console.log(`[call] Ended — SID: ${callSid}, duration: ${callDuration}s`);
  res.sendStatus(204);
});

module.exports = router;
