// ====================================================================
// YAGA CALLS CLIENT RELATION BOT — Conversational & Outreach Engine
// Implements an interactive "Trading Archetype Test" conversion funnel
// Runs standalone or via PM2: node concierge_bot_engine.js
// ====================================================================

require('dotenv').config();
const http = require('http');
const { Client } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_CONCIERGE_BOT_TOKEN || '8821931231:AAF43WpD1m-7RqJLKwnwltuiWwCTBTiQ6gM';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
const PORT = process.env.CONCIERGE_BOT_PORT || 3006;

// Database Query Helper
async function queryDb(sql, params = []) {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query(sql, params);
    await client.end();
    return res;
  } catch (err) {
    console.error('Database query error:', err.message);
    try { await client.end(); } catch (e) {}
    throw err;
  }
}

// Telegram Send Message Helper
async function sendMessage(chatId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
    return res;
  } catch (err) {
    console.error('sendMessage failed:', err.message);
  }
}

// Get or Create User State
async function getOrCreateUserState(telegramId, firstName, username) {
  const selectRes = await queryDb('SELECT * FROM public.concierge_user_states WHERE telegram_id = $1', [telegramId]);
  if (selectRes.rows.length > 0) {
    return selectRes.rows[0];
  }

  const insertRes = await queryDb(`
    INSERT INTO public.concierge_user_states (telegram_id, first_name, username, current_stage)
    VALUES ($1, $2, $3, 'WELCOME')
    RETURNING *
  `, [telegramId, firstName, username]);
  return insertRes.rows[0];
}

// Update User State
async function updateUserState(telegramId, fields) {
  const sets = [];
  const params = [telegramId];
  let index = 2;

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = $${index++}`);
    params.push(val);
  }

  await queryDb(`
    UPDATE public.concierge_user_states
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE telegram_id = $1
  `, params);
}

// Keyboards for Gamified Archetype Funnel
function getWelcomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '⚡ Start My Alignment Test', callback_data: 'start_test' }]
    ]
  };
}

function getQuestion1Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 Technical charts and indicator lines', callback_data: 'q1_charts' }],
      [{ text: '📰 Breaking news headlines and twitter chatter', callback_data: 'q1_news' }],
      [{ text: '🔄 Following trade calls from social groups', callback_data: 'q1_groups' }]
    ]
  };
}

function getQuestion2Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '😰 I hold and hope it recovers to break-even', callback_data: 'q2_hope' }],
      [{ text: '😡 I double-down to lower my entry price', callback_data: 'q2_double' }],
      [{ text: '🛡️ My stop-loss exits immediately (I feel safe)', callback_data: 'q2_safe' }]
    ]
  };
}

function getDiagnosticKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔬 How does Yaga Calls solve this?', callback_data: 'show_methodology' }]
    ]
  };
}

function getMethodologyKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📈 Show me real proof of this in action', callback_data: 'show_proof' }]
    ]
  };
}

function getCloseKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👑 Let\'s discuss pricing & VIP access', callback_data: 'close_vip' }],
      [{ text: '💬 I want a custom risk consultation', callback_data: 'close_consultation' }],
      [{ text: '🛡️ I\'d like to stay in the loop for free', callback_data: 'close_free' }]
    ]
  };
}

function getHandoffKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '💬 Message Desk Directly (@yagacalls47)', url: 'https://t.me/yagacalls47' }]
    ]
  };
}

// Bot Command & Message Update Processor
async function handleUpdate(update) {
  // 1. Text Messages & Start command
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const telegramId = String(msg.from.id);
    const username = msg.from.username ? `@${msg.from.username}` : 'N/A';
    const firstName = msg.from.first_name || 'Trader';

    if (text.startsWith('/start')) {
      await getOrCreateUserState(telegramId, firstName, username);
      await updateUserState(telegramId, { current_stage: 'WELCOME' });

      const welcomeText = 
`👑 *YAGA CALLS | CLIENT RELATION DESK*

Hello *${firstName}*. Welcome to our intelligence portal.

I am not a basic system assistant. I am here to help you configure your market approach, protect your trading capital, and introduce you to our desk. 

Before we look at charts or numbers, we need to understand your trading psychology. 

Let's run a quick, 1-minute *Trading Alignment Test* to map your market archetype and identify where your capital might be leaking.`;

      await sendMessage(chatId, welcomeText, getWelcomeKeyboard());
    } else {
      await sendMessage(chatId, `Hello *${firstName}*. If you'd like to chat with a live representative or ask a specific question, feel free to contact our Desk directly at @yagacalls47. I'm always standing by to help!`);
    }
  }

  // 2. Button callback clicks (Conversational Stages)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const telegramId = String(cb.from.id);
    const firstName = cb.from.first_name || 'Trader';

    // Start Test -> Question 1
    if (data === 'start_test') {
      await updateUserState(telegramId, { current_stage: 'QUESTION_1' });
      const text = 
`⚡ *STAGE 1: THE INITIATION*

Let's look at how you make decisions.

When you decide to buy a coin or open a position, what is the primary factor that drives your choice?`;
      await sendMessage(chatId, text, getQuestion1Keyboard());
    }

    // Question 1 Answers -> Question 2
    else if (data.startsWith('q1_')) {
      const choice = data.replace('q1_', '');
      await updateUserState(telegramId, { 
        current_stage: 'QUESTION_2',
        risk_segment: choice === 'charts' ? 'CHART_READER' : (choice === 'news' ? 'HYPE_HUNTER' : 'SOCIAL_FOLLOWER')
      });

      const text = 
`⚡ *STAGE 2: THE REACTION*

Got it. Now let's look at how you handle risk.

Imagine you enter a trade, and the price immediately goes against you by *5%*. What is your realistic response?`;
      await sendMessage(chatId, text, getQuestion2Keyboard());
    }

    // Question 2 Answers -> Diagnostic
    else if (data.startsWith('q2_')) {
      const choice = data.replace('q2_', '');
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const archetype = state.risk_segment || 'TRADER';

      let diagnosticTitle = '';
      let diagnosticBody = '';

      if (choice === 'hope') {
        diagnosticTitle = 'THE HOPEFUL HOLDER';
        diagnosticBody = `You hate taking losses. When a trade goes red, your brain blocks out the risk and tells you to wait. This emotional bias is exactly how retail traders turn a small 5% stop-loss into a permanent 80% portfolio drawdown. It is exhausting and drains your confidence.`;
      } else if (choice === 'double') {
        diagnosticTitle = 'THE RISK MULTIPLIER';
        diagnosticBody = `You double-down to lower your entry average. While this can work in ranging markets, it exposes you to massive capital liquidation when a real narrative trend breaks down. You are fighting the market trend instead of respecting it.`;
      } else {
        diagnosticTitle = 'THE STRUCTURED OBSERVER';
        diagnosticBody = `You respect stop-losses, which is a great start. However, if your decision engine is still based on noisy Twitter chatter or retail indicators, you are simply exiting valid trades early because you don't have deep narrative conviction.`;
      }

      await updateUserState(telegramId, { 
        current_stage: 'DIAGNOSTIC_REVEALED',
        loss_pain: choice !== 'safe'
      });

      const text = 
`🔍 *YOUR MARKET ARCHETYPE: ${diagnosticTitle}*

*${firstName}*, here is what our calculations show:

${diagnosticBody}

Please understand: *This is not your fault.* The retail market is engineered by institutional players to exploit these exact emotional loops. To survive, you must stop guessing and start calculating.`;

      await sendMessage(chatId, text, getDiagnosticKeyboard());
    }

    // Show Methodology
    else if (data === 'show_methodology') {
      await updateUserState(telegramId, { current_stage: 'METHODOLOGY_SHOWN' });
      const text = 
`🔬 *HOW WE DO IT | THE WHISPER METHOD*

At Yaga Calls, we replace retail noise with institutional calculations.

We spend our days researching:
• *Global Innovations*: Tracking where actual developer and venture capital is rotating.
• *Political & Macro Factors*: Calculating how interest rates and regulations shift liquidity.
• *Corporate Whispers*: Hearing the intentional steps of major whales and market makers.

We analyze all of this, calculate the invalidation price, and only place trades where the potential reward is at least 3x larger than the risk. If a trade goes against us, we exit cleanly. No hope, no averaging—just math.`;

      await sendMessage(chatId, text, getMethodologyKeyboard());
    }

    // Show Tailored Proof
    else if (data === 'show_proof') {
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const archetype = state.risk_segment || 'CHART_READER';

      let proofText = '';
      if (archetype === 'HYPE_HUNTER') {
        proofText = `Instead of chasing coin pumps after they go viral on Twitter, we trace on-chain smart money movements weeks in advance. For example, during the AI narrative rotation, we calculated the entry price before retail media coverage started, securing clean risk-free returns.`;
      } else if (archetype === 'CHART_READER') {
        proofText = `We don't draw arbitrary retail lines. We wait for structural deviations (like a sweep of macro BTC liquidity). Once major whales step in, we enter alongside them with a tight stop-loss.`;
      } else {
        proofText = `We provide complete transparency. Every trade setup we share has a detailed technical chart and a narrative thesis explaining the exact logic, so you can learn while you grow.`;
      }

      await updateUserState(telegramId, { current_stage: 'PROOF_SHOWN' });

      const text = 
`📈 *REAL-WORLD PROOF*

Here is how our methodology works in practice:

${proofText}

We log every single trade setup—both our successes and our losses—honestly in our verified performance ledger. You can audit our history at any time.`;

      await sendMessage(chatId, text, getCloseKeyboard());
    }

    // Handoff & Closures
    else if (data === 'close_vip' || data === 'close_consultation') {
      const type = data === 'close_vip' ? 'VIP Access' : 'Custom Consultation';
      await updateUserState(telegramId, { current_stage: 'CLOSE_INITIATED' });

      const text = 
`🤝 *Manually Connecting You to Our Desk*

Excellent choice, *${firstName}*. I have logged your diagnostic profile in our database.

I am putting you in touch with our Desk Director. No automated checkouts, no sales bots—just real professionals who will review your goals and set up your access manually.

Tap the button below to message our Desk directly. We already know your name and diagnostic profile!`;

      await sendMessage(chatId, text, getHandoffKeyboard());
    }

    else if (data === 'close_free') {
      await updateUserState(telegramId, { current_stage: 'COMPLETED' });
      const text = 
`Understood, *${firstName}*. Take all the time you need to watch our desk from the free channel.

I will send you a brief, 3-bullet *Market Pulse* safety update every Sunday evening to keep you updated on macro rotations and capital flow changes. 

If you ever want to run your diagnostic average again or upgrade, just type a message here or contact @yagacalls47. Have a safe and profitable week!`;
      await sendMessage(chatId, text);
    }
  }
}

// ── CONCIERGE AUTOMATED NURTURE & OUTREACH ENGINE ──
async function runAutoNudgeAndOutreach() {
  console.log('⏳ Running Concierge Nurture & Outreach check...');
  try {
    // 1. Onboarding Drop-off Recovery (Auto-Nudge after 30 minutes of inactivity)
    const nudgeRes = await queryDb(`
      SELECT * FROM public.concierge_user_states
      WHERE current_stage IN ('WELCOME', 'QUESTION_1', 'QUESTION_2', 'DIAGNOSTIC_REVEALED', 'METHODOLOGY_SHOWN')
        AND updated_at < NOW() - INTERVAL '30 minutes'
        AND updated_at > NOW() - INTERVAL '2 hours'
    `);

    for (const u of nudgeRes.rows) {
      console.log(`✉️ Sending 30-minute drop-off recovery nudge to: ${u.first_name} (${u.telegram_id})`);
      const nudgeText = 
`Hey *${u.first_name}*, I know you're busy! I saved your progress in our alignment test right here.

Tap the button below to resume your test and unlock your profile case study:`;
      await sendMessage(u.telegram_id, nudgeText, getWelcomeKeyboard());
      await updateUserState(u.telegram_id, { current_stage: 'CLOSE_INITIATED' }); 
    }

    // 2. Inactive User Empathy Pulse (Outreach check after 14 days)
    const outreachRes = await queryDb(`
      SELECT * FROM public.concierge_user_states
      WHERE (current_stage = 'COMPLETED' OR current_stage = 'CLOSE_INITIATED')
        AND updated_at < NOW() - INTERVAL '14 days'
        AND (reengagement_sent_at IS NULL OR reengagement_sent_at < NOW() - INTERVAL '30 days')
      LIMIT 10
    `);

    for (const u of outreachRes.rows) {
      console.log(`💎 Sending 14-day Empathy Pulse Outreach to: ${u.first_name} (${u.telegram_id})`);
      const pulseText = 
`Hey *${u.first_name}*, just wanted to drop a quick check-in. The markets have been quite choppy this past week.

I hope you've been protecting your capital and staying safe. If there's a specific coin narrative or setup logic you'd like our Desk to review, just reply directly to this message. We review every response personally.

Safe trading, and have a great week!`;
      await sendMessage(u.telegram_id, pulseText);
      await updateUserState(u.telegram_id, { reengagement_sent_at: new Date() });
    }

  } catch (err) {
    console.error('Error in outreach engine task:', err.message);
  }
}

// Run checks every 10 minutes in the background
setInterval(runAutoNudgeAndOutreach, 10 * 60 * 1000);

// HTTP Health Check Server
const server = http.createServer((req, res) => {
  if (req.url === '/api/concierge/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yaga_client_relation_bot', engine: 'Yaga Client Relation Engine V1.0' }));
  } else {
    res.writeHead(404); res.end();
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Client Relation API Health Check running on http://localhost:${PORT}`);
});

// Enforce branding name and info programmatically on startup
async function enforceBotBranding() {
  try {
    const namePayload = { name: "Yaga Client Relation" };
    const descPayload = { description: "Configure your market approach, run your trading alignment test, and speak directly to our professional intelligence desk." };
    const shortDescPayload = { short_description: "Professional alignment & client relation engine for Yaga Calls." };

    await fetch(`${API_BASE}/setMyName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(namePayload)
    });
    
    await fetch(`${API_BASE}/setMyDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(descPayload)
    });

    await fetch(`${API_BASE}/setMyShortDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shortDescPayload)
    });

    console.log('✅ Bot profile descriptions and branding successfully synchronized programmatically.');
  } catch (err) {
    console.error('Branding synchronization warning:', err.message);
  }
}

// Polling updates loop
let offset = 0;
async function pollUpdates() {
  await enforceBotBranding();
  console.log(`🤖 Yaga Client Relation Bot Active! Polling updates...`);
  const allowedUpdates = JSON.stringify(["message", "callback_query"]);

  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=30&allowed_updates=${encodeURIComponent(allowedUpdates)}`).then(r => r.json());
      if (res.ok && res.result && Array.isArray(res.result) && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          try {
            await handleUpdate(update);
          } catch (handlerErr) {
            console.error('❌ Error handling update:', handlerErr.message);
          }
        }
      }
    } catch (err) {
      console.error('Polling warning (retrying in 3s):', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

pollUpdates();
