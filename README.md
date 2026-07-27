# Twilio AI Voice Receptionist

A production-ready AI phone receptionist built with **Twilio**, **Claude (Haiku)**, and **Node.js**. Answers inbound calls in natural language, books appointments, sends SMS confirmations, and posts call summaries to your CRM or n8n webhook — all configurable without touching code.

**Built by Rakibul Hasan · AI Automation Specialist**

---

## What It Does

```
Caller dials your Twilio number
        │
        ▼
Twilio → POST /voice/inbound
        │
        ▼
Greeting played ("Thank you for calling Sunrise Dental...")
        │
        ▼  (speech gathered by Twilio — no Whisper needed)
Caller speaks → transcription POSTed to /voice/gather
        │
        ▼
Claude Haiku processes conversation history + system prompt
        │
        ▼
Response spoken back via Polly.Joanna TTS
        │
   ┌────┴──────────────────┐
   ▼                       ▼                    ▼
[BOOK_APPOINTMENT]    [TRANSFER_HUMAN]      Continue loop
   │                       │
SMS confirmation     Dial staff number
Post to n8n          
   │
   ▼
Call ends → /voice/status
   │
   ▼
Full transcript + caller info POSTed to n8n webhook
(updates CRM, emails staff, logs to Airtable, etc.)
```

---

## Features

- **Natural language** — caller speaks freely, no "press 1 for..." menus
- **Multi-turn memory** — full conversation context per call session
- **Appointment booking** — Claude extracts name/date/time/reason and confirms
- **SMS confirmations** — sent to caller immediately after booking
- **Human transfer** — escalates urgent calls automatically
- **Post-call webhook** — full transcript + caller info POSTed to n8n/Make/Zapier
- **Zero config switching** — change business name, hours, and persona via `.env` only
- **Polly TTS** — Twilio's Amazon Polly voices (Joanna, Matthew, etc.) — no ElevenLabs cost
- **Production-safe** — Twilio signature validation, session TTL, error fallback

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/rakibul-aidev/twilio-ai-voice-receptionist
cd twilio-ai-voice-receptionist
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your Twilio credentials, Anthropic API key, and business details
```

### 3. Expose locally with ngrok

```bash
npx ngrok http 3000
# Copy the HTTPS URL → set BASE_URL in .env
```

### 4. Run

```bash
npm run dev
```

### 5. Configure Twilio

In your [Twilio Console](https://console.twilio.com/):
- Go to **Phone Numbers → Manage → Active Numbers**
- Select your number
- Under **Voice Configuration**:
  - **A call comes in:** Webhook → `https://your-ngrok.ngrok.io/voice/inbound` (HTTP POST)
  - **Call status changes:** `https://your-ngrok.ngrok.io/voice/status` (HTTP POST)

Call your Twilio number — you're live.

---

## Configuration Reference

All business configuration lives in `.env` — no code changes needed to deploy for a new client.

| Variable | Description | Example |
|---|---|---|
| `BUSINESS_NAME` | Business name spoken in greeting | `"Sunrise Dental Clinic"` |
| `BUSINESS_HOURS` | Spoken to callers asking about hours | `"Mon–Fri, 9am–5pm"` |
| `BUSINESS_PHONE` | Number to dial on human transfer | `+1234567890` |
| `TIMEZONE` | For hours context in system prompt | `America/New_York` |
| `POST_CALL_WEBHOOK_URL` | n8n/Make/Zapier endpoint for call summaries | `https://...` |

---

## Post-Call Webhook Payload

When a call ends, this JSON is POSTed to `POST_CALL_WEBHOOK_URL`:

```json
{
  "event": "call_ended",
  "timestamp": "2026-07-27T14:32:01.000Z",
  "callSid": "CAxxxxx",
  "from": "+1234567890",
  "duration": "87",
  "callerInfo": {
    "phone": "+1234567890",
    "name": "Sarah Johnson"
  },
  "appointmentRequested": true,
  "transferRequested": false,
  "transcript": "Caller: Hi, I'd like to book a cleaning...\nReceptionist: Of course! What date works for you?...",
  "businessName": "Sunrise Dental Clinic"
}
```

In n8n, trigger a workflow on this webhook to: create a CRM contact, add a calendar event, email the front desk, log to Airtable, etc.

---

## Customising the AI Persona

Edit `src/config/system_prompt.js` to change:
- The bot's personality and tone
- What information it asks for
- How it handles specific scenarios (after-hours, emergencies, specific services)
- What action tags it emits (`[BOOK_APPOINTMENT]`, `[TRANSFER_HUMAN]`, `[END_CALL]`)

The system prompt uses environment variables for business details, so the same prompt template works for any client.

---

## Deployment

### Railway / Render (recommended for clients)

```bash
# Set environment variables in the platform dashboard
# Point Twilio webhooks to your deployed URL
```

### Docker

```bash
docker build -t ai-receptionist .
docker run -p 3000:3000 --env-file .env ai-receptionist
```

---

## Cost Estimate (per 100 calls/month)

| Component | Cost |
|---|---|
| Twilio inbound calls (avg 2 min) | ~$0.80 |
| Twilio speech recognition (built-in) | Included |
| Claude Haiku API (~10 turns/call) | ~$0.50 |
| Twilio SMS confirmations | ~$0.40 |
| **Total** | **~$1.70 / 100 calls** |

Compare to: a part-time receptionist at $15/hour answering 5 calls/hour = **$30 per 100 calls**.

---

## Extending This

| Feature | How |
|---|---|
| Google Calendar booking | Add `googleapis` and call Calendar API in `webhook.js` when `[BOOK_APPOINTMENT]` fires |
| ElevenLabs voice | Replace `twiml.say()` with a `twiml.play()` pointing to ElevenLabs audio URL |
| WhatsApp follow-up | Add Twilio WhatsApp message in `sendSmsConfirmation()` |
| Multi-language | Set `language` in Gather and adjust system prompt; Polly supports 30+ languages |
| Redis session store | Replace the `Map` in `session.js` with `ioredis` for multi-instance deployments |

---

*Built by [Rakibul Hasan](https://contra.com/rakibul_hasan_7gp46knu) · github.com/rakibul-aidev*
