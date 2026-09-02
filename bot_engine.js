const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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

// Telegram Bot Credentials
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ FATAL: TELEGRAM_BOT_TOKEN is not defined in environment variables!');
}
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Set Telegram Bot Official Command Menu (Public Creator Commands Only)
async function registerBotCommands() {
  try {
    const commands = [
      { command: 'start', description: '⚡️ Open Main Menu & Buttons' },
      { command: 'register', description: '✍️ Register as Team Creator' },
      { command: 'tasks', description: '📋 View My Daily Assignments' },
      { command: 'onboard', description: '🌐 Setup Target Platform Accounts' },
      { command: 'issue', description: '⚠️ Report a Platform Problem' }
    ];
    const res = await fetch(`${API_BASE}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    }).then(r => r.json());
    console.log('✅ Registered Telegram Bot Command Menu:', res);
  } catch (err) {
    console.error('Failed to set bot commands:', err.message);
  }
}

let offset = 0;
async function pollUpdates() {
  await registerBotCommands();
  console.log('🚀 Telegram Long Polling Active! Listening for creator, joinee & chat_join_request updates...');
  const allowedUpdates = JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member", "chat_join_request"]);

  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: offset,
          timeout: 25,
          allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member", "chat_join_request"]
        }),
        signal: AbortSignal.timeout(35000)
      }).then(r => r.json());

      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          console.log(`📩 Incoming Update [${update.update_id}]:`, update.message?.text || update.callback_query?.data || (update.chat_member ? `Joinee ${update.chat_member?.new_chat_member?.user?.first_name}` : 'Event'));
          try {
            await handleUpdate(update);
          } catch (handlerErr) {
            console.error('❌ Error handling update:', handlerErr.message);
          }
        }
      }
    } catch (err) {
      console.error('Polling connection retry:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

pollUpdates();


