// ====================================================================
// YAGA CALLS PARTNER PROGRAM — DEDICATED TELEGRAM BOT ENGINE
// Bot Token: 8839038800:AAHLIOgv-dTxpMsXMLjXnimGJqXL-AN4e3I
// Runs standalone or via PM2: node affiliate_bot_engine.js
// ====================================================================

const http = require('http');
const { Client } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_AFFILIATE_BOT_TOKEN || '8839038800:AAHLIOgv-dTxpMsXMLjXnimGJqXL-AN4e3I';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FREE_GROUP_CHAT_ID = process.env.YAGA_FREE_GROUP_CHAT_ID || '-1002360563454'; // Yaga Calls Free Group
const DB_CONNECTION = 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
const PORT = process.env.AFFILIATE_BOT_PORT || 3005;

// Postgres Client Helper
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

// Send Telegram Message Helper
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

// Generate Custom Telegram Chat Invite Link via Telegram Bot API
async function createChatInviteLink(affiliateId, affiliateName) {
  try {
    const res = await fetch(`${API_BASE}/createChatInviteLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: FREE_GROUP_CHAT_ID,
        name: `AFF_${affiliateId}_${affiliateName.replace(/\s+/g, '_')}`.substring(0, 32),
        creates_join_request: false
      })
    }).then(r => r.json());

    if (res.ok && res.result && res.result.invite_link) {
      return res.result.invite_link;
    } else {
      console.warn('createChatInviteLink fallback used:', res.description);
      return `https://t.me/+yaga_ref_${affiliateId}`;
    }
  } catch (err) {
    console.error('Failed to create invite link:', err.message);
    return `https://t.me/+yaga_ref_${affiliateId}`;
  }
}

// Build Main Keyboard Menu
function getMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🚀 Get My Referral Link', callback_data: 'get_link' },
        { text: '📊 My Live Stats', callback_data: 'view_stats' }
      ],
      [
        { text: '📘 Partner Handbook & Rules', callback_data: 'view_handbook' },
        { text: '💳 Set/Update Wallet', callback_data: 'set_wallet' }
      ],
      [
        { text: '💬 Contact Affiliate Manager', url: 'https://t.me/yagacalls47' }
      ]
    ]
  };
}

// Handlers for Bot Updates
async function handleUpdate(update) {
  // 1. Handle Direct Commands & Messages
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const telegramId = String(msg.from.id);
    const username = msg.from.username ? `@${msg.from.username}` : 'N/A';
    const firstName = msg.from.first_name || 'Partner';

    if (text.startsWith('/start')) {
      const welcomeText = 
`🏆 *WELCOME TO THE YAGA CALLS PARTNER PROGRAM*

Earn *15% to 25% recurring commissions* on every trader you bring into our ecosystem.

*Why Top Creators Choose Yaga Calls:*
✅ *100% Performance-Based*: Zero salary burn, pure upside.
✅ *Native Telegram Tracking*: Zero cookie drop-offs.
✅ *Real-Time Dopamine*: Instant alert when someone joins free or buys Premium.
✅ *Crypto Payouts*: USDT / USDC / SOL / BTC delivered weekly.

Tap below to get your unique invite link and start earning today!`;

      await sendMessage(chatId, welcomeText, getMainKeyboard());
    }

    else if (text.startsWith('/stats')) {
      await showStats(chatId, telegramId);
    }

    else if (text.startsWith('/wallet')) {
      await sendMessage(chatId, `💳 *UPDATE PAYOUT WALLET*\n\nPlease reply to this message with your *USDT/USDC/SOL/BTC Wallet Address*.\nExample: \`TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ\``);
    }

    else if (text.startsWith('/guide') || text.startsWith('/rules')) {
      await showHandbook(chatId);
    }

    // Capture Wallet Address Replies
    else if (text.length > 20 && !text.startsWith('/')) {
      const wallet = text.trim();
      const affId = `AFF_${telegramId}`;

      await queryDb(`
        INSERT INTO public.affiliates (id, telegram_id, telegram_handle, first_name, wallet_address, status)
        VALUES ($1, $2, $3, $4, $5, 'Active')
        ON CONFLICT (telegram_id) DO UPDATE 
        SET wallet_address = $5, updated_at = NOW()
      `, [affId, telegramId, username, firstName, wallet]);

      await sendMessage(chatId, `✅ *WALLET SAVED SUCCESSFULLY!*\n\nYour Payout Address: \`${wallet}\`\n\nCommissions will be sent directly to this address.`, getMainKeyboard());
    }
  }

  // 2. Handle Inline Button Callbacks
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const telegramId = String(cb.from.id);
    const username = cb.from.username ? `@${cb.from.username}` : 'N/A';
    const firstName = cb.from.first_name || 'Partner';

    if (data === 'get_link') {
      const affId = `AFF_${telegramId}`;

      // Check if affiliate exists
      let dbRes = await queryDb(`SELECT * FROM public.affiliates WHERE telegram_id = $1`, [telegramId]);
      let affiliate = dbRes.rows[0];

      if (!affiliate || !affiliate.invite_link) {
        const link = await createChatInviteLink(telegramId, firstName);
        await queryDb(`
          INSERT INTO public.affiliates (id, telegram_id, telegram_handle, first_name, invite_link, status)
          VALUES ($1, $2, $3, $4, $5, 'Active')
          ON CONFLICT (telegram_id) DO UPDATE
          SET invite_link = $5, updated_at = NOW()
        `, [affId, telegramId, username, firstName, link]);

        affiliate = { invite_link: link };
      }

      const linkMsg = 
`🚀 *YOUR UNIQUE TELEGRAM REFERRAL LINK*

Here is your exclusive tracking link for the Yaga Calls Free Telegram Group:
👉 \`${affiliate.invite_link}\`

*How it works:*
1. Share this link on Twitter, Telegram, YouTube, or with your network.
2. Anyone who joins the free group via your link is permanently tagged to you.
3. You receive an instant alert when they join, and a *15%–25% commission alert* when they upgrade to Premium!`;

      await sendMessage(chatId, linkMsg, getMainKeyboard());
    }

    else if (data === 'view_stats') {
      await showStats(chatId, telegramId);
    }

    else if (data === 'view_handbook') {
      await showHandbook(chatId);
    }

    else if (data === 'set_wallet') {
      await sendMessage(chatId, `💳 *UPDATE PAYOUT WALLET*\n\nPlease send your USDT (TRC20/ERC20) or SOL/BTC wallet address in the chat.\n\nExample:\n\`TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ\``);
    }
  }

  // 3. Handle Chat Member Joins (Tracking Telegram Free Group Invites)
  if (update.chat_member) {
    const cm = update.chat_member;
    const inviteLink = cm.invite_link?.invite_link;
    const newMember = cm.new_chat_member?.user;

    if (inviteLink && newMember && !newMember.is_bot) {
      // Find matching affiliate by invite_link
      const res = await queryDb(`SELECT * FROM public.affiliates WHERE invite_link = $1`, [inviteLink]);
      const aff = res.rows[0];

      if (aff) {
        const joineeId = String(newMember.id);
        const joineeUsername = newMember.username ? `@${newMember.username}` : 'N/A';
        const joineeFirstName = newMember.first_name || 'Member';
        const refId = `REF-${Date.now()}-${joineeId}`;

        // Record referral
        await queryDb(`
          INSERT INTO public.affiliate_referrals (id, affiliate_id, joined_telegram_id, joined_username, joined_first_name, status)
          VALUES ($1, $2, $3, $4, $5, 'FREE_MEMBER')
          ON CONFLICT DO NOTHING
        `, [refId, aff.id, joineeId, joineeUsername, joineeFirstName]);

        // Increment free joins counter
        await queryDb(`UPDATE public.affiliates SET total_free_joins = total_free_joins + 1 WHERE id = $1`, [aff.id]);

        // Notify Affiliate in real-time
        const alertMsg = 
`🔔 *NEW FREE MEMBER JOINED VIA YOUR LINK!*

👤 *User*: ${joineeFirstName} (${joineeUsername})
📊 *Your Total Free Joinees*: ${Number(aff.total_free_joins) + 1}

_When this member purchases a Premium Plan, you will receive an instant 15% commission alert!_`;

        await sendMessage(aff.telegram_id, alertMsg);
        console.log(`✅ Tracked free joinee ${joineeUsername} for affiliate ${aff.telegram_handle}`);
      }
    }
  }
}

// Helper: Render Live Stats
async function showStats(chatId, telegramId) {
  const dbRes = await queryDb(`SELECT * FROM public.affiliates WHERE telegram_id = $1`, [telegramId]);
  const aff = dbRes.rows[0];

  if (!aff) {
    await sendMessage(chatId, `⚠️ *No Affiliate Account Found*\n\nTap *Get My Referral Link* below to activate your partner profile!`, getMainKeyboard());
    return;
  }

  const statsMsg = 
`📊 *YOUR LIVE AFFILIATE PERFORMANCE*

👤 *Partner*: ${aff.first_name} (${aff.telegram_handle})
🎯 *Commission Tier*: *${aff.commission_rate}%*

👥 *Total Free Joinees*: \`${aff.total_free_joins}\`
💰 *Total Premium Conversions*: \`${aff.total_conversions}\`

💵 *Total Earned*: \`$${Number(aff.total_earned).toFixed(2)} USDT\`
✅ *Total Paid Out*: \`$${Number(aff.total_paid).toFixed(2)} USDT\`
⏳ *Unpaid Balance*: \`$${Number(aff.unpaid_balance).toFixed(2)} USDT\`

💳 *Payout Wallet*: \`${aff.wallet_address || 'Not Set (Tap Set/Update Wallet)'}\`
🔗 *Your Link*: \`${aff.invite_link || 'Not Generated'}\``;

  await sendMessage(chatId, statsMsg, getMainKeyboard());
}

// Helper: Render Affiliate Handbook & Transparency Rules
async function showHandbook(chatId) {
  const handbookMsg = 
`📘 *YAGA CALLS AFFILIATE HANDBOOK & TRANSPARENCY RULES*

*1. 100% Automated Tracking*
- Every link generated by this bot is linked directly to your partner ID.
- When someone joins the free group via your link, they are tagged to you forever.

*2. Commission Structure*
- *Tier 1 (Standard)*: 15% on all subscriptions.
  - Quarterly ($299) → *You earn $44.85 USDT*
  - Half-Yearly ($499) → *You earn $74.85 USDT*
  - Yearly ($799) → *You earn $119.85 USDT*
- *Tier 2 (Pro Creator - 10+ sales/mo)*: 20% commission.
- *Tier 3 (VIP Institutional - 25+ sales/mo)*: 25% commission.

*3. Ethical Promotion Rules*
✅ *DO*: Share setup breakdowns, market narrative analysis, Twitter threads, YouTube reviews, and personal trade results.
❌ *DON'T*: Spam random groups, make fake profit guarantees, impersonate Yaga Calls staff, or create self-referral accounts.

*4. Payout Policy*
- Paid directly in USDT / USDC / SOL / BTC.
- Minimum payout threshold: $50 USDT.
- Issued weekly every Friday or upon request via CRM.`;

  await sendMessage(chatId, handbookMsg, getMainKeyboard());
}

// Trigger Commission Alert (Called by CRM or Webhook when member upgrades)
async function triggerConversionNotification(affiliateId, joinedUsername, planName, planAmount, commissionEarned) {
  try {
    const dbRes = await queryDb(`SELECT * FROM public.affiliates WHERE id = $1 OR telegram_id = $1`, [affiliateId]);
    const aff = dbRes.rows[0];

    if (aff) {
      const newTotalEarned = Number(aff.total_earned) + Number(commissionEarned);
      const newUnpaidBalance = Number(aff.unpaid_balance) + Number(commissionEarned);
      const newConversions = Number(aff.total_conversions) + 1;

      await queryDb(`
        UPDATE public.affiliates 
        SET total_conversions = $1, total_earned = $2, unpaid_balance = $3, updated_at = NOW()
        WHERE id = $4
      `, [newConversions, newTotalEarned, newUnpaidBalance, aff.id]);

      const alertMsg = 
`💰 *BOOM! NEW COMMISSION EARNED!*

🎉 *Referred Member*: ${joinedUsername}
📦 *Purchased Plan*: ${planName} ($${planAmount})
💵 *Commission Earned (${aff.commission_rate}%)*: *+$${Number(commissionEarned).toFixed(2)} USDT*

⏳ *Your New Unpaid Balance*: *$${newUnpaidBalance.toFixed(2)} USDT*
_Payout will be processed according to your wallet settings._`;

      await sendMessage(aff.telegram_id, alertMsg);
      return { success: true, unpaidBalance: newUnpaidBalance };
    }
  } catch (err) {
    console.error('Error triggering conversion notification:', err.message);
  }
}

// Register Official Bot Menu
async function registerBotCommands() {
  try {
    const commands = [
      { command: 'start', description: '⚡️ Open Partner Dashboard & Menu' },
      { command: 'stats', description: '📊 Check My Live Earnings & Joinees' },
      { command: 'wallet', description: '💳 Set or Update Payout Wallet' },
      { command: 'guide', description: '📘 Read Affiliate Rules & Handbook' }
    ];
    await fetch(`${API_BASE}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });
    console.log('✅ Registered Telegram Affiliate Bot Command Menu.');
  } catch (err) {
    console.error('Failed to register bot commands:', err.message);
  }
}

// HTTP Server for CRM & API Integration
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/affiliate/conversion' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await triggerConversionNotification(
          payload.affiliateId,
          payload.joinedUsername || '@member',
          payload.planName || 'VIP Subscription',
          payload.planAmount || 299,
          payload.commissionEarned || 44.85
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  else if (req.url === '/api/affiliate/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yagapartnerbot', engine: 'Yaga Affiliate Engine' }));
  }

  else { res.writeHead(404); res.end(); }
});

server.listen(PORT, () => {
  console.log(`🚀 Affiliate API Engine running on http://localhost:${PORT}`);
});

// Telegram Long Polling Loop
let offset = 0;
async function pollUpdates() {
  await registerBotCommands();
  console.log('🤖 Telegram Partner Program Bot Active! Long polling listening for updates...');
  const allowedUpdates = JSON.stringify(["message", "callback_query", "chat_member"]);

  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=30&allowed_updates=${encodeURIComponent(allowedUpdates)}`).then(r => r.json());
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          try {
            await handleUpdate(update);
          } catch (handlerErr) {
            console.error('❌ Error in affiliate update handler:', handlerErr.message);
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

pollUpdates();
