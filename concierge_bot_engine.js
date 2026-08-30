// ====================================================================
// YAGA CALLS CLIENT RELATION BOT — Conversational & Outreach Engine
// Implements an interactive 6-question "Trading Archetype Test" funnel
// Runs standalone or via PM2: node concierge_bot_engine.js
// ====================================================================

require('dotenv').config();
const http = require('http');
const { Client } = require('pg');

// Client-relation bot token — env only, never hardcoded. Rotate it in
// .env (and on the VPS via update_vps_env.js), not in this file.
const BOT_TOKEN = process.env.TELEGRAM_CONCIERGE_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ FATAL: TELEGRAM_CONCIERGE_BOT_TOKEN is not set in the environment.');
  process.exit(1);
}
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
    INSERT INTO public.concierge_user_states (telegram_id, first_name, username, current_stage, archetype_score)
    VALUES ($1, $2, $3, 'WELCOME', 0)
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

// Keyboards for Gamified Archetype Funnel (6 Questions)
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
      [{ text: '🔄 I scalp daily (quick in-and-out)', callback_data: 'q1_scalp' }],
      [{ text: '📈 I swing trade (holding days/weeks)', callback_data: 'q1_swing' }],
      [{ text: '💎 I hold long-term (spot investor)', callback_data: 'q1_invest' }]
    ]
  };
}

function getQuestion2Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '💵 I only trade Spot (No leverage)', callback_data: 'q2_spot' }],
      [{ text: '⚡ Moderate Leverage (2x - 5x)', callback_data: 'q2_med_lev' }],
      [{ text: '🔥 High Leverage Futures (10x+)', callback_data: 'q2_high_lev' }]
    ]
  };
}

function getQuestion3Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 Indicator lines and chart setups', callback_data: 'q3_charts' }],
      [{ text: '📰 News headlines & Twitter trends', callback_data: 'q3_hype' }],
      [{ text: '🔔 Alerts and copy trade groups', callback_data: 'q3_signals' }]
    ]
  };
}

function getQuestion4Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '🛡️ Strict stop-loss hits (I exit red)', callback_data: 'q4_stop' }],
      [{ text: '😰 Hold & hope it returns to break-even', callback_data: 'q4_hope' }],
      [{ text: '😡 Average down to lower entry average', callback_data: 'q4_average' }]
    ]
  };
}

function getQuestion5Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '😰 Exit early out of fear it will reverse', callback_data: 'q5_early' }],
      [{ text: '🤷 I let it run but have no exit target', callback_data: 'q5_noplan' }],
      [{ text: '🎯 Exit cleanly at predefined targets', callback_data: 'q5_targets' }]
    ]
  };
}

function getQuestion6Keyboard() {
  return {
    inline_keyboard: [
      [{ text: '📉 Recover my previous losses', callback_data: 'q6_recover' }],
      [{ text: '💵 Generate consistent monthly income', callback_data: 'q6_income' }],
      [{ text: '💎 Compounding long-term wealth safely', callback_data: 'q6_wealth' }]
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
      await updateUserState(telegramId, { current_stage: 'WELCOME', archetype_score: 0 });

      const welcomeText = 
`👑 *YAGA CALLS | CLIENT RELATION DESK*

Hello *${firstName}*. Welcome to our intelligence portal.

I am not a basic system assistant. I am here to help you configure your market approach, protect your trading capital, and introduce you to our desk. 

Before we look at charts or numbers, we need to understand your trading psychology. 

Let's run a quick, 6-question *Trading Alignment Test* to map your market archetype and identify where your capital might be leaking.`;

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
      await updateUserState(telegramId, { current_stage: 'QUESTION_1', archetype_score: 0 });
      const text = 
`📊 *QUESTION 1: TIME HORIZON*

How would you describe your typical trading frequency and holding style?`;
      await sendMessage(chatId, text, getQuestion1Keyboard());
    }

    // Q1 Answers -> Question 2
    else if (data.startsWith('q1_')) {
      const choice = data.replace('q1_', '');
      const score = choice === 'scalp' ? 3 : (choice === 'swing' ? 2 : 1);
      
      await updateUserState(telegramId, { 
        current_stage: 'QUESTION_2',
        archetype_score: score
      });

      const text = 
`📊 *QUESTION 2: DEBT & LEVERAGE*

What risk and leverage levels do you normally use in your trading accounts?`;
      await sendMessage(chatId, text, getQuestion2Keyboard());
    }

    // Q2 Answers -> Question 3
    else if (data.startsWith('q2_')) {
      const choice = data.replace('q2_', '');
      const score = choice === 'high_lev' ? 3 : (choice === 'med_lev' ? 2 : 1);
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const currentScore = Number(state.archetype_score || 0);

      await updateUserState(telegramId, { 
        current_stage: 'QUESTION_3',
        archetype_score: currentScore + score
      });

      const text = 
`📊 *QUESTION 3: ENTRY CATALYSTS*

When you decide to open a position, what is the primary trigger that makes you buy?`;
      await sendMessage(chatId, text, getQuestion3Keyboard());
    }

    // Q3 Answers -> Question 4
    else if (data.startsWith('q3_')) {
      const choice = data.replace('q3_', '');
      const score = choice === 'hype' ? 3 : (choice === 'charts' ? 2 : 1);
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const currentScore = Number(state.archetype_score || 0);

      await updateUserState(telegramId, { 
        current_stage: 'QUESTION_4',
        archetype_score: currentScore + score
      });

      const text = 
`📊 *QUESTION 4: RED TRADES (RISK)*

If a trade goes against you immediately by *5%*, what is your typical response?`;
      await sendMessage(chatId, text, getQuestion4Keyboard());
    }

    // Q4 Answers -> Question 5
    else if (data.startsWith('q4_')) {
      const choice = data.replace('q4_', '');
      const score = choice === 'average' ? 3 : (choice === 'hope' ? 2 : 1);
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const currentScore = Number(state.archetype_score || 0);

      await updateUserState(telegramId, { 
        current_stage: 'QUESTION_5',
        archetype_score: currentScore + score
      });

      const text = 
`📊 *QUESTION 5: GREEN TRADES (PROFIT)*

Once your position goes into profit, how do you manage the trade to exit?`;
      await sendMessage(chatId, text, getQuestion5Keyboard());
    }

    // Q5 Answers -> Question 6
    else if (data.startsWith('q5_')) {
      const choice = data.replace('q5_', '');
      const score = choice === 'noplan' ? 3 : (choice === 'early' ? 2 : 1);
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const currentScore = Number(state.archetype_score || 0);

      await updateUserState(telegramId, { 
        current_stage: 'QUESTION_6',
        archetype_score: currentScore + score
      });

      const text = 
`📊 *QUESTION 6: PORTFOLIO OBJECTIVES*

What is the main goal you are trying to accomplish with your capital right now?`;
      await sendMessage(chatId, text, getQuestion6Keyboard());
    }

    // Q6 Answers -> Diagnostic Reveal
    else if (data.startsWith('q6_')) {
      const choice = data.replace('q6_', '');
      const score = choice === 'recover' ? 3 : (choice === 'income' ? 2 : 1);
      const state = await getOrCreateUserState(telegramId, firstName, '');
      const totalScore = Number(state.archetype_score || 0) + score;

      let archetype = '';
      let diagnosticTitle = '';
      let diagnosticBody = '';
      let lossPainFlag = true;

      // Score classification
      if (totalScore <= 10) {
        archetype = 'SILENT_BLEEDER';
        diagnosticTitle = 'THE SILENT BLEEDER';
        diagnosticBody = `You prefer safer trading parameters (spot or swing trading), but your capital slowly drains away because you hold losing positions too long hoping they break even, while cutting your winning setups too early out of fear.`;
        lossPainFlag = true;
      } else if (totalScore <= 14) {
        archetype = 'WANDERING_RETAILER';
        diagnosticTitle = 'THE WANDERING RETAILER';
        diagnosticBody = `You trade based on news trends, chatroom alerts, or indicator setups, but you lack a consistent strategy. You exit early due to market swings and feel frustrated because you keep missing the real trend rotations.`;
        lossPainFlag = true;
      } else {
        archetype = 'LEVERAGED_GAMBLER';
        diagnosticTitle = 'THE LEVERAGED GAMBLER';
        diagnosticBody = `You chase high-leverage futures and average down on losses. While this can provide quick wins, it exposes you to sudden account liquidation. You are constantly fighting the market trend and feeling under pressure.`;
        lossPainFlag = true;
      }

      await updateUserState(telegramId, { 
        current_stage: 'DIAGNOSTIC_REVEALED',
        archetype_score: totalScore,
        risk_segment: archetype,
        loss_pain: lossPainFlag
      });

      const text = 
`🔍 *TEST OUTCOME: ${diagnosticTitle}*

*${firstName}*, here is what our calculations reveal:

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
      const archetype = state.risk_segment || 'WANDERING_RETAILER';

      let proofText = '';
      if (archetype === 'WANDERING_RETAILER') {
        proofText = `Instead of chasing coin pumps after they go viral on Twitter, we trace on-chain smart money movements weeks in advance. For example, during the AI narrative rotation, we calculated the entry price before retail media coverage started, securing clean risk-free returns.`;
      } else if (archetype === 'SILENT_BLEEDER') {
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
`Understood, *${firstName}*. Take all the time you need to watch our desk.

Click the button below to join our Free Intelligence Channel (tracked and verified by our system):

I will also send you a brief, 3-bullet *Market Pulse* safety update here every Sunday evening to keep you updated on macro rotations and capital flow changes. 

If you ever want to run your diagnostic alignment test again or upgrade, just type a message here or contact @yagacalls47. Have a safe and profitable week!`;
      
      const freeKeyboard = {
        inline_keyboard: [
          [{ text: '📢 Join Free Intelligence Channel', url: 'https://t.me/+JFf8kBf01mg3OTg1' }]
        ]
      };
      await sendMessage(chatId, text, freeKeyboard);
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
      WHERE current_stage IN ('WELCOME', 'QUESTION_1', 'QUESTION_2', 'QUESTION_3', 'QUESTION_4', 'QUESTION_5', 'QUESTION_6', 'DIAGNOSTIC_REVEALED', 'METHODOLOGY_SHOWN')
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
