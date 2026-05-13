# CloseMate AI (Standalone Chrome Extension MVP)

CloseMate AI analyzes **visible WhatsApp Web chat messages** and generates copy-paste-ready replies for Malaysian Takaful agents.

## Key MVP Features
- Manifest V3 Chrome extension
- Floating Analyze Chat UI on `https://web.whatsapp.com`
- Local License Key validation (demo keys)
- User-provided Gemini API key (stored in `chrome.storage.local`)
- Reply tone selection
- Direct Gemini API call from extension (no backend)
- JSON analysis sections: `lead_score`, `emotion`, `objection`, `summary`, `suggested_reply`, `follow_up`, `next_action`
- Copy buttons for Suggested Reply and Follow Up

## Demo License Keys
- `CLOSEMATE-DEMO-001`
- `CLOSEMATE-DEMO-002`
- `CLOSEMATE-DEMO-003`
- `CLOSEMATE-LIFETIME-001`
- `CLOSEMATE-LIFETIME-002`

## Setup (No Backend Required)
1. Open Chrome -> `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `closemate-ai-extension`
4. Open `https://web.whatsapp.com`
5. Open CloseMate panel
6. Enter License Key and click **Save License Key**
7. Enter Gemini API key from Google AI Studio and click **Save API Key**
8. Choose Reply Tone
9. Click **Analyze Chat**
10. Copy **Suggested Reply** or **Copy Follow Up**

## Security Notes
- No backend required for this MVP.
- Extension calls Gemini directly from `content.js`.
- Gemini API key is entered by user and stored locally in browser storage.
- API key is not hardcoded.
- For stronger production security, move license validation to online backend/database later.
