const { checkOverdueSLA } = require('../../bot_engine_serverless');

module.exports = async (req, res) => {
  try {
    await checkOverdueSLA();
    return res.status(200).json({ success: true, message: 'Cron SLA check executed' });
  } catch (err) {
    console.error('Cron SLA error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
