# CloseMate AI (Chrome Extension MVP)

CloseMate AI analyzes **visible WhatsApp Web chat messages** for Malaysian Takaful agents.

## Features
- Manifest V3 Chrome extension
- Floating **Analyze Chat** button on `https://web.whatsapp.com`
- Extracts currently visible conversation messages only
- Sends extracted messages to backend API
- Receives and renders JSON analysis in right-side floating panel
- Popup settings for backend URL

## AI Response Schema
The backend is expected to return JSON with:
- `lead_score`
- `emotion`
- `objection`
- `summary`
- `suggested_reply`
- `follow_up`
- `next_action`

## Folder Structure

```
closemate-ai-extension/
├─ manifest.json
├─ content.js
├─ styles/
│  └─ content.css
├─ popup/
│  ├─ popup.html
│  ├─ popup.css
│  └─ popup.js
├─ icons/
│  ├─ icon16.svg
│  ├─ icon48.svg
│  └─ icon128.svg
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  └─ .env.example
└─ README.md
```

## Install Extension (Local)
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `closemate-ai-extension` folder.

## Run Backend API Example
1. Open terminal:
   ```bash
   cd closemate-ai-extension/backend
   npm install
   cp .env.example .env
   # set OPENAI_API_KEY in .env
   npm start
   ```
2. Backend runs on `http://localhost:8787` by default.

## Configure Extension
1. Click extension icon → popup opens.
2. Set **Backend URL** (default: `http://localhost:8787`).
3. Open `https://web.whatsapp.com` and select a conversation.
4. Choose a **Reply Tone** in the panel (default: Friendly & Warm).
5. Click floating **Analyze Chat** button.

## How To Test (End-to-End)

### 1) Backend health check
Run this after starting backend:
```bash
curl -i http://localhost:8787/analyze-chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":["[10:10 AM] Prospect: I need more details on takaful plan"]}'
```
Expected:
- HTTP `200` (or an OpenAI error if API key/model is invalid)
- JSON object with keys: `lead_score`, `emotion`, `objection`, `summary`, `suggested_reply`, `follow_up`, `next_action`

### 2) Extension injection test on WhatsApp Web
1. Open `https://web.whatsapp.com`.
2. Open any chat thread.
3. Confirm a floating **Analyze Chat** button appears at bottom-right.
4. Click button and confirm right-side panel opens.

Expected:
- Button is visible and clickable.
- Panel opens and first shows loading state (`Analyzing visible chat…`).

### 3) Visible-message extraction test
1. Keep one chat open.
2. Scroll up/down so different messages are visible.
3. Click **Analyze Chat** each time.

Expected:
- Output changes as visible chat context changes.
- If no messages are visible, panel shows readable error.

### 4) Popup config persistence test
1. Open extension popup.
2. Set backend URL to a custom endpoint (example: `http://localhost:8787`).
3. Click **Save**.
4. Close and reopen popup.

Expected:
- Saved URL persists via `chrome.storage.sync`.

### 5) Safety scope test (MVP guardrails)
Validate that:
- Extension does **not** auto-send WhatsApp messages.
- Extension does **not** click WhatsApp controls automatically.
- Extension only analyzes currently visible chat text.

## Scope & Safety (MVP)
- ✅ Analyze visible chat only
- ✅ No CRM
- ✅ No auto-send
- ✅ No WhatsApp automation

## Troubleshooting: "Failed to fetch"
If the panel shows **Failed to fetch**, the extension loaded correctly but could not reach your backend API.

Checklist:
1. Confirm backend is running:
   ```bash
   cd closemate-ai-extension/backend
   npm start
   ```
2. Confirm endpoint responds:
   ```bash
   curl -i http://localhost:8787/analyze-chat \
     -H 'Content-Type: application/json' \
     -d '{"messages":["test"]}'
   ```
3. In extension popup, set **Backend URL** exactly to `http://localhost:8787` and click **Save**.
4. Refresh `https://web.whatsapp.com` and click **Analyze Chat** again.
