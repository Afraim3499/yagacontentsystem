// ====================================================================
// YAGA CALLS OPERATIONS SYSTEM — LOCAL ENGINE RUNNER
// Uses bot_engine_serverless.js core logic
// ====================================================================

const http = require('http');
const {
  handleUpdate,
  triggerStaggered3BatchDispatch,
  checkPendingStaggeredBatches,
  checkOverdueSLA,
  replyToIssue
} = require('./bot_engine_serverless');

const PORT = 3001;

console.log('🤖 Starting Yaga Calls Telegram Bot Engine (@yagacontentbot)...');

// ── HTTP SERVER FOR LOCAL CRM API CALLS ──
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/dispatch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await triggerStaggered3BatchDispatch(payload.date || new Date().toISOString().split('T')[0]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  else if (req.url === '/api/reply-issue' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { ticketId, creatorId, replyText } = JSON.parse(body || '{}');
        const result = await replyToIssue(ticketId, creatorId, replyText);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  else if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yagacontentbot', mode: 'Local Engine' }));
  }

  else { res.writeHead(404); res.end(); }
});

server.listen(PORT, () => {
  console.log(`🚀 Local API Engine: http://localhost:${PORT}`);
  console.log(`📊 100% Vercel Serverless Ready`);
});

// Periodic background DB checkers for local dev
setInterval(checkPendingStaggeredBatches, 30 * 1000);
setInterval(checkOverdueSLA, 5 * 60 * 1000);

// Telegram Long Polling for Local Dev
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let offset = 0;
async function pollUpdates() {
  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=30`).then(r => r.json());
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          handleUpdate(update);
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

pollUpdates();
