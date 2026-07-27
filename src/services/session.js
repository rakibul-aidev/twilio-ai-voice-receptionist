'use strict';

/**
 * In-memory session store — one conversation history per Twilio CallSid.
 * For production, swap the Map for Redis to persist across server restarts
 * and support multiple instances.
 */

const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSession(callSid) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      callSid,
      messages: [],          // Claude message history
      callerInfo: {},        // Collected: name, phone, reason
      appointmentRequested: false,
      transferRequested: false,
      createdAt: Date.now(),
    });
  }
  return sessions.get(callSid);
}

function addMessage(callSid, role, content) {
  const session = getSession(callSid);
  session.messages.push({ role, content });
  return session;
}

function updateCallerInfo(callSid, updates) {
  const session = getSession(callSid);
  Object.assign(session.callerInfo, updates);
  return session;
}

function deleteSession(callSid) {
  sessions.delete(callSid);
}

// Clean up stale sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [callSid, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(callSid);
    }
  }
}, 10 * 60 * 1000);

module.exports = { getSession, addMessage, updateCallerInfo, deleteSession };
