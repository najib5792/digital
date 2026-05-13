import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const VALID_LICENSE_KEYS = [
  'CLOSEMATE-DEMO-001',
  'CLOSEMATE-DEMO-002',
  'CLOSEMATE-DEMO-003',
  'CLOSEMATE-LIFETIME-001',
  'CLOSEMATE-LIFETIME-002'
];

const FALLBACK_JSON = {
  lead_score: 0,
  emotion: 'Unknown',
  objection: 'Unable to detect',
  summary: 'Unable to analyze the chat.',
  suggested_reply: 'Maaf, sistem tak dapat analyze chat ni buat masa sekarang. Cuba sekali lagi ya.',
  follow_up: 'Boleh cuba refresh WhatsApp Web dan tekan Analyze Chat semula.',
  next_action: 'Try again'
};

app.post('/analyze-chat', async (req, res) => {
  try {
    const { license_key, gemini_api_key, tone = 'Malay Casual', messages } = req.body || {};

    if (!license_key) return res.status(401).json({ error: 'License key is required' });
    if (!VALID_LICENSE_KEYS.includes(license_key)) return res.status(403).json({ error: 'Invalid license key' });
    if (!gemini_api_key) return res.status(401).json({ error: 'Gemini API key is required' });
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'No messages provided' });

    const prompt = `You are CloseMate AI, a WhatsApp sales assistant for Malaysian Takaful agents.
Your job: Analyze the visible WhatsApp conversation and help the agent understand the prospect.
You must return strict valid JSON only.
Do not include markdown.
Do not include explanation outside JSON.
Analyze: Prospect interest level, Emotion, Main objection, Summary of conversation, Best suggested reply, Best follow-up message, Recommended next action.
The suggested reply must follow this selected tone: ${tone}
Important reply rules:
Use natural Malaysian Malay
Suitable for WhatsApp
Short and copy-paste ready
Friendly but sales-oriented
Do not sound robotic
Do not overpromise
Do not pressure too hard
Suitable for Takaful conversation
Avoid using dash symbols in sentences
If prospect is asking about Medical Card, collect basic details politely
If prospect is asking about Hibah, explain simply and ask for basic details
If prospect is cold, reply softly
If prospect shows buying intent, guide to quotation or appointment
Return this exact JSON schema:
{"lead_score":0,"emotion":"","objection":"","summary":"","suggested_reply":"","follow_up":"","next_action":""}
lead_score must be a number from 0 to 100.

Messages:
${messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(gemini_api_key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || 'Gemini request failed';
      return res.status(resp.status).json({ error: msg });
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = extractJson(raw);
    return res.json(parsed || FALLBACK_JSON);
  } catch {
    return res.status(500).json({ error: 'server error' });
  }
});

function extractJson(rawText) {
  try { return { ...FALLBACK_JSON, ...JSON.parse(rawText) }; } catch {}
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return { ...FALLBACK_JSON, ...JSON.parse(match[0]) }; } catch { return null; }
}

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`CloseMate backend running on http://localhost:${port}`);
});
