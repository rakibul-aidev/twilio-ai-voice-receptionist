'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt } = require('../config/system_prompt');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send a message to Claude and return the response text.
 * Parses any action tags ([BOOK_APPOINTMENT], [END_CALL], [TRANSFER_HUMAN])
 * out of the response.
 */
async function getReply(messages) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',   // Haiku: fast + cheap — ideal for voice latency
    max_tokens: 150,              // Keep responses short for voice
    system: buildSystemPrompt(),
    messages,
  });

  const raw = response.content[0].text;

  // Extract action tags
  const actions = {
    bookAppointment: null,
    endCall: false,
    transferHuman: false,
  };

  const bookMatch = raw.match(
    /\[BOOK_APPOINTMENT:\s*name="([^"]*)",\s*date="([^"]*)",\s*time="([^"]*)",\s*reason="([^"]*)"\]/
  );
  if (bookMatch) {
    actions.bookAppointment = {
      name: bookMatch[1],
      date: bookMatch[2],
      time: bookMatch[3],
      reason: bookMatch[4],
    };
  }

  if (raw.includes('[END_CALL]')) actions.endCall = true;
  if (raw.includes('[TRANSFER_HUMAN]')) actions.transferHuman = true;

  // Strip action tags from the spoken text
  const spokenText = raw
    .replace(/\[BOOK_APPOINTMENT:[^\]]*\]/g, '')
    .replace(/\[END_CALL\]/g, '')
    .replace(/\[TRANSFER_HUMAN\]/g, '')
    .trim();

  return { spokenText, actions };
}

module.exports = { getReply };
