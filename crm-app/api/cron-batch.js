const { checkPendingStaggeredBatches } = require('../../bot_engine_serverless');

module.exports = async (req, res) => {
  try {
    await checkPendingStaggeredBatches();
    return res.status(200).json({ success: true, message: 'Cron batch check executed' });
  } catch (err) {
    console.error('Cron batch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
