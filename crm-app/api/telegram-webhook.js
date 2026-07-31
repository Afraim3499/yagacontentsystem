// Vercel Serverless Function: Telegram Webhook Handler
const { handleUpdate } = require('../../bot_engine_serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    try {
      const update = req.body;
      await handleUpdate(update);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({ status: 'ACTIVE', endpoint: 'Telegram Webhook' });
};
