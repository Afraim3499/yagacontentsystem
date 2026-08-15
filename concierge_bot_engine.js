// ====================================================================
// YAGA CALLS CONCIERGE BOT — Conversational & Outreach Engine (V1.0)
// Establishes a warm, human-centric conversion funnel on Telegram
// Runs standalone or via PM2: node concierge_bot_engine.js
// ====================================================================

require('dotenv').config();
const http = require('http');
const { Client } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_CONCIERGE_BOT_TOKEN || '8642738902:AAHconcierge_placeholder_token';
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

// Keyboards Builder
function getWelcomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔴 I keep losing capital to market noise', callback_data: 'select_loss_pain' }],
      [{ text: '🟢 I want a professional, calm trading routine', callback_data: 'select_structure' }]
    ]
  };
}

function getMethodOrProofKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🛡️ How do you protect capital? (Method)', callback_data: 'show_method' }],
      [{ text: '📈 Show me your historical setups (Proof)', callback_data: 'show_proof' }]
    ]
  };
}

function getRiskSegmentKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '💵 I trade Spot only (Low Risk)', callback_data: 'risk_spot' }],
      [{ text: '⚡ I trade Futures / Leverage (Medium-High)', callback_data: 'risk_futures' }],
      [{ text: '🎓 I am a complete beginner, just learning', callback_data: 'risk_beginner' }]
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
      const state = await getOrCreateUserState(telegramId, firstName, username);
      await updateUserState(telegramId, { current_stage: 'WELCOME' });

      const welcomeText = 
`Hi *${firstName}*, I’m really glad you found your way to Yaga Calls.

I’m not a command-bot or a billing assistant—I’m here to personally help you navigate our desk and make sure you have the best possible experience. The crypto market can be incredibly noisy, and my goal is to make it simple, structured, and safe for you.

Tell me honestly, *${firstName}*, what describes your trading journey best right now?`;

      await sendMessage(chatId, welcomeText, getWelcomeKeyboard());
    } else {
      // General response fallback or direct human route instructions
      await sendMessage(chatId, `Hi *${firstName}*, if you'd like to chat with a live representative or ask a specific question, feel free to contact our Desk directly at @yagacalls47. I'm always standing by to help!`);
    }
  }

  // 2. Button callback clicks (Conversational Stages)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const telegramId = String(cb.from.id);
    const firstName = cb.from.first_name || 'Trader';

    // Segment & Stage 2 Transition
    if (data === 'select_loss_pain') {
      await updateUserState(telegramId, { current_stage: 'DECONSTRUCT_NOISE', loss_pain: true });
      const text = 
`I hear you, *${firstName}*. It is incredibly frustrating. The truth is, 90% of retail traders lose because they chase green candles and hype. The system is designed to liquidate you.

At Yaga Calls, we don't do hype. We don't guarantee millions. We focus on narrative capital flows and strict stop-losses to make sure your downside is always protected. Because keeping your money is the first step to growing it.`;
      await sendMessage(chatId, text, getMethodOrProofKeyboard());
    }

    else if (data === 'select_structure') {
      await updateUserState(telegramId, { current_stage: 'DECONSTRUCT_NOISE', professional_structure: true });
      const text = 
`That is exactly the right mindset, *${firstName}*. Discipline is what separates professional market players from gamblers.

We treat digital assets like an institutional capital desk. Every setup we share has a clear invalidation level (stop-loss) and a logical 'why' behind it. We look at narrative rotations—where the big fund managers are moving their cash—rather than drawing random lines on charts.`;
      await sendMessage(chatId, text, getMethodOrProofKeyboard());
    }

    // Segment & Stage 3 Transition (Method or Proof clicked)
    else if (data === 'show_method' || data === 'show_proof') {
      await updateUserState(telegramId, { current_stage: 'CUSTOMIZATION_LAYER' });
      const text = 
`Before I show you our setups, let's make this personal to your situation. Everyone trades differently.

To help me customize what I share with you, what is your current comfort level with leverage and trading size?`;
      await sendMessage(chatId, text, getRiskSegmentKeyboard());
    }

    // Segment & Stage 4 Transition (Risk segments clicked)
    else if (data === 'risk_spot' || data === 'risk_futures' || data === 'risk_beginner') {
      const segment = data === 'risk_spot' ? 'SPOT' : (data === 'risk_futures' ? 'LEVERAGE' : 'BEGINNER');
      await updateUserState(telegramId, { current_stage: 'PROOF_SHOWN', risk_segment: segment });

      let tailText = '';
      if (segment === 'SPOT') {
        tailText = `Instead of panic-selling during market crashes, our desk identifies structural shifts. We rotate capital out of weak sectors and into high-conviction spot assets, allowing you to build portfolio value quietly and cleanly.`;
      } else if (segment === 'LEVERAGE') {
        tailText = `We look for macro deviations (such as a sweep of BTC liquidity). We calculate strict risk parameters, enforce stop-losses, and aim for clean 3:1 reward-to-risk setups to compound futures balances safely.`;
      } else {
        tailText = `We guide you step-by-step. You will learn to read narrative changes and understand how stop-losses work before you ever click buy. Education always comes before risk.`;
      }

      const text = 
`Got it. Here is a brief look at how we configure trades for a *${segment}* risk profile.

${tailText}

We publish all of our results—both wins and losses—fully verified in our performance ledger. You can review them transparently at any time.`;

      await sendMessage(chatId, text, getCloseKeyboard());
    }

    // Stage 5 Transition (Empathic Close & Handoffs)
    else if (data === 'close_vip' || data === 'close_consultation') {
      const choice = data === 'close_vip' ? 'VIP Access' : 'Custom Consultation';
      await updateUserState(telegramId, { current_stage: 'CLOSE_INITIATED' });

      const text = 
`Wonderful choice, *${firstName}*. I’ve prepared a custom profile for you based on our conversation.

I'm putting you in touch with our Desk Director, who will manually set up your access or answer any final questions you have. No bots, no automated checkouts—just real humans who care about your capital.

Click the button below to message our Desk directly. They already know your name and profile!`;

      await sendMessage(chatId, text, getHandoffKeyboard());
    }

    else if (data === 'close_free') {
      await updateUserState(telegramId, { current_stage: 'COMPLETED' });
      const text = 
`I completely respect that, *${firstName}*. Take all the time you need to observe our desk from the free group.

I've registered your profile, and I'll send you a brief Sunday 'Market Pulse' safety check-in once a week to keep you updated on narrative changes. 

If you ever want to upgrade or ask a question, simply type a message here or contact @yagacalls47. Have a safe and successful trading week!`;
      await sendMessage(chatId, text);
    }
  }
}

// ── CONCIERGE AUTOMATED NURTURE & OUTREACH ENGINE ──
// Auto-nudge user if they drop off mid-onboarding or go inactive

async function runAutoNudgeAndOutreach() {
  console.log('⏳ Running Concierge Nurture & Outreach check...');
  try {
    // 1. Onboarding Drop-off Recovery (Auto-Nudge after 30 minutes of inactivity)
    // Select users stuck in WELCOME, DECONSTRUCT_NOISE, or CUSTOMIZATION_LAYER updated between 30 mins and 2 hours ago
    const nudgeRes = await queryDb(`
      SELECT * FROM public.concierge_user_states
      WHERE current_stage IN ('WELCOME', 'DECONSTRUCT_NOISE', 'CUSTOMIZATION_LAYER')
        AND updated_at < NOW() - INTERVAL '30 minutes'
        AND updated_at > NOW() - INTERVAL '2 hours'
    `);

    for (const u of nudgeRes.rows) {
      console.log(`✉️ Sending 30-minute drop-off recovery nudge to: ${u.first_name} (${u.telegram_id})`);
      const nudgeText = 
`Hey *${u.first_name}*, I know you're busy! I saved your progress right here. 

Tap the link below or send me a reply whenever you have a quiet moment to review your custom trading profile:`;
      await sendMessage(u.telegram_id, nudgeText, getWelcomeKeyboard());
      
      // Update stage so we don't nudge them repeatedly
      await updateUserState(u.telegram_id, { current_stage: 'CLOSE_INITIATED' }); // Move state forward to skip future loops
    }

    // 2. Inactive User Empathy Pulse (Outreach check after 14 days)
    // Select users who completed/closed onboarding but haven't interacted in 14 days and haven't had re-engagement sent recently
    const outreachRes = await queryDb(`
      SELECT * FROM public.concierge_user_states
      WHERE (current_stage = 'COMPLETED' OR current_stage = 'CLOSE_INITIATED')
        AND updated_at < NOW() - INTERVAL '14 days'
        AND (reengagement_sent_at IS NULL OR reengagement_sent_at < NOW() - INTERVAL '30 days')
      LIMIT 10 -- Safety check limits batches to prevent rate limits
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
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yaga_concierge_bot', engine: 'Yaga Concierge Engine V1.0' }));
  } else {
    res.writeHead(404); res.end();
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Concierge API Health Check running on http://localhost:${PORT}`);
});

// Polling updates loop
let offset = 0;
async function pollUpdates() {
  console.log(`🤖 Yaga Concierge Bot Active! Polling updates...`);
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
