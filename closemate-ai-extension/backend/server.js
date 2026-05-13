import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/analyze-chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const prompt = `You are an assistant for Malaysian Takaful sales conversations.
Analyze ONLY the provided visible messages and output strict JSON with keys:
lead_score, emotion, objection, summary, suggested_reply, follow_up.

Messages:\n${messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: prompt,
        text: { format: { type: 'json_object' } }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const raw = data.output?.[0]?.content?.[0]?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw };
    }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'server error' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`CloseMate backend running on http://localhost:${port}`);
});
