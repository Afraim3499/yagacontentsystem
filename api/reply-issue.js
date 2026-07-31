// Vercel Serverless Function: CRM Owner Reply to Problem Ticket
const { replyToIssue } = require('../bot_engine_serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { ticketId, creatorId, replyText } = req.body || {};
    const result = await replyToIssue(ticketId, creatorId, replyText);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Reply issue error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
