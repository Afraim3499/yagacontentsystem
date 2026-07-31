const { triggerStaggered3BatchDispatch } = require('../../bot_engine_serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = req.body || {};
    const dateStr = payload.date || new Date().toISOString().split('T')[0];
    const result = await triggerStaggered3BatchDispatch(dateStr);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Dispatch API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
