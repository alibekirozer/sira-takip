// api/notify-teams.js
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { title, text } = req.body;
  const TEAMS_WEBHOOK_URL = 'https://kocsistem.webhook.office.com/webhookb2/44660f66-4726-4a54-842b-1c313fd46f06@1e1aa76b-4b02-45f4-9417-2e13eb0da973/IncomingWebhook/b038df184116466a9792f0a9bb1fb161/cf410a20-3801-452e-8fea-eb078c94b436/V2w0AOfq5gCHsScmZc5IfIEIQIfyFaDvzgQME9gkyjvHaI1';
  try {
    await axios.post(TEAMS_WEBHOOK_URL, {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "summary": title,
      "themeColor": "0076D7",
      "title": title,
      "text": text
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Teams bildirimi gönderilemedi.' });
  }
}