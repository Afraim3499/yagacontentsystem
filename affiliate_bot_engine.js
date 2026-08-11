// ====================================================================
// YAGA CALLS PARTNER PROGRAM — DEDICATED TELEGRAM BOT ENGINE (V2.0)
// Runs standalone or via PM2: node affiliate_bot_engine.js
// ====================================================================

const http = require('http');
const { Client } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_AFFILIATE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ FATAL: TELEGRAM_AFFILIATE_BOT_TOKEN is not defined in environment variables!');
}
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FREE_GROUP_CHAT_ID = process.env.YAGA_FREE_GROUP_CHAT_ID || '-1002360563454'; // Yaga Calls Free Group
const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
const PORT = process.env.AFFILIATE_BOT_PORT || 3005;

// Memory state for user wallet entry prompts
const userStates = new Map(); // telegramId -> 'AWAITING_WALLET'

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
function getMainKeyboard(walletSet = true) {
  return {
    inline_keyboard: [
      [
        { text: '🚀 Get My Referral Link', callback_data: 'get_link' },
        { text: '📊 My Live Dashboard', callback_data: 'view_stats' }
      ],
      [
        { text: walletSet ? '💳 Update Payout Wallet' : '⚠️ Set Payout Wallet (Required)', callback_data: 'set_wallet' },
        { text: '📢 Promo Kit & Content', callback_data: 'view_promokit' }
      ],
      [
        { text: '📘 Partner Handbook & Rules', callback_data: 'view_handbook' },
        { text: '💬 Support & VIP Manager', url: 'https://t.me/yagacalls47' }
      ]
    ]
  };
}

// Helper: Calculate Tier Progress Bar
function getTierProgress(conversions, rate) {
  if (conversions >= 25) {
    return { tier: 'Tier 3 (VIP Institutional - 25%)', bar: '██████████ 100%', nextGoal: 'MAX TIER ACHIEVED 🎉' };
  } else if (conversions >= 10) {
    const needed = 25 - conversions;
    const pct = Math.min(100, Math.floor(((conversions - 10) / 15) * 100));
    const filled = Math.floor(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
    return { tier: 'Tier 2 (Pro Creator - 20%)', bar, nextGoal: `${needed} more sales to reach 25% VIP Tier!` };
  } else {
    const needed = 10 - conversions;
    const pct = Math.min(100, Math.floor((conversions / 10) * 100));
    const filled = Math.floor(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
    return { tier: 'Tier 1 (Standard Partner - 15%)', bar, nextGoal: `${needed} more sales to reach 20% Pro Tier!` };
  }
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

    // Awaiting Wallet Address Input
    if (userStates.get(telegramId) === 'AWAITING_WALLET' && !text.startsWith('/')) {
      const wallet = text.trim();
      const affId = `AFF_${telegramId}`;

      // Basic crypto address format validation
      if (wallet.length < 24) {
        await sendMessage(chatId, `❌ *INVALID WALLET ADDRESS*\n\nPlease enter a valid crypto address (USDT TRC20, ERC20, SOL, or BTC).\n\nExample:\n\`TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ\``);
        return;
      }

      await queryDb(`
        INSERT INTO public.affiliates (id, telegram_id, telegram_handle, first_name, wallet_address, status)
        VALUES ($1, $2, $3, $4, $5, 'Active')
        ON CONFLICT (telegram_id) DO UPDATE 
        SET wallet_address = $5, updated_at = NOW()
      `, [affId, telegramId, username, firstName, wallet]);

      userStates.delete(telegramId);

      const confirmMsg = 
`✅ *PAYOUT WALLET SAVED SUCCESSFULLY!*

💳 *Registered Wallet*: \`${wallet}\`

Your 15%–25% commissions will be automatically calculated and paid weekly to this address.

Tap below to get your unique referral link!`;

      await sendMessage(chatId, confirmMsg, getMainKeyboard(true));
      return;
    }

    if (text.startsWith('/start')) {
      const affId = `AFF_${telegramId}`;
      const dbRes = await queryDb(`SELECT * FROM public.affiliates WHERE telegram_id = $1`, [telegramId]);
      const aff = dbRes.rows[0];

      const welcomeText = 
`🏆 *WELCOME TO THE YAGA CALLS PARTNER PROGRAM*
_Institutional Crypto Signals & Performance-Based Affiliate System_

Hello *${firstName}*! Turn your crypto network, trading audience, or social channels into passive recurring income.

🔥 *WHY PARTNERS SUCCEED WITH US:*
• *15% to 25% Commission Ladder*: Earn $45 to $200+ per enrollment.
• *Native Telegram Link Tracking*: 0% cookie drop-off. Permanent attribution.
• *Real-Time Notifications*: Instant alerts on free joinees & sales.
• *Weekly Crypto Settlements*: USDT / USDC / SOL / BTC delivered every Friday.
• *Direct Partner Email*: \`partner@yagacalls.com\` (Reach out anytime with queries!)

---
⚡️ *QUICK ONBOARDING STEPS:*
1️⃣ Tap *🚀 Get My Referral Link* to generate your tracking link.
2️⃣ Tap *💳 Set Payout Wallet* to receive weekly crypto settlements.
3️⃣ Tap *📢 Promo Kit & Content* for ready-to-use marketing templates.`;

      await sendMessage(chatId, welcomeText, getMainKeyboard(Boolean(aff?.wallet_address)));
    }

    else if (text.startsWith('/stats')) {
      await showStats(chatId, telegramId);
    }

    else if (text.startsWith('/wallet')) {
      userStates.set(telegramId, 'AWAITING_WALLET');
      await sendMessage(chatId, `💳 *SET/UPDATE YOUR PAYOUT WALLET*\n\nPlease reply with your *USDT (TRC20/ERC20), SOL, or BTC* wallet address:\n\n*Example TRC20 Address:*\n\`TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ\``);
    }

    else if (text.startsWith('/promokit') || text.startsWith('/promo')) {
      await showPromoKit(chatId);
    }

    else if (text.startsWith('/guide') || text.startsWith('/rules')) {
      await showHandbook(chatId);
    }

    else if (text.startsWith('/help')) {
      await sendMessage(chatId, `💬 *YAGA CALLS PARTNER SUPPORT*\n\nHave any questions, need custom commission rates, institutional partnerships, or payout assistance?\n\n✉️ *Official Email*: \`partner@yagacalls.com\`\n📱 *Telegram Support*: @yagacalls47`, getMainKeyboard());
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

        affiliate = { invite_link: link, wallet_address: affiliate?.wallet_address };
      }

      const linkMsg = 
`🚀 *YOUR UNIQUE TELEGRAM REFERRAL LINK*

Here is your permanent tracking link for the Yaga Calls Free Group:
👉 \`${affiliate.invite_link}\`

---
📌 *HOW ATTRIBUTION WORKS:*
• Anyone who clicks your link and joins our free group is permanently tagged under your account.
• You get an **instant notification** when a free member joins.
• When they upgrade to Premium VIP, you earn **15% to 25% recurring commission**!

${!affiliate.wallet_address ? '⚠️ *REMINDER*: Tap *Set Payout Wallet* to ensure your crypto payouts are deposited smoothly!' : '✅ *Payout Wallet Configured*: `' + affiliate.wallet_address + '`'}`;

      await sendMessage(chatId, linkMsg, getMainKeyboard(Boolean(affiliate.wallet_address)));
    }

    else if (data === 'view_stats') {
      await showStats(chatId, telegramId);
    }

    else if (data === 'view_promokit') {
      await showPromoKit(chatId);
    }

    else if (data === 'view_handbook') {
      await showHandbook(chatId);
    }

    else if (data === 'set_wallet') {
      userStates.set(telegramId, 'AWAITING_WALLET');
      await sendMessage(chatId, `💳 *SET/UPDATE PAYOUT WALLET*\n\nPlease reply directly to this message with your *USDT (TRC20/ERC20), SOL, or BTC* wallet address.\n\n*Example TRC20 Address:*\n\`TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ\``);
    }
  }

  // 3. Handle Chat Member Joins (Tracking Telegram Free Group Invites)
  if (update.chat_member) {
    const cm = update.chat_member;
    const inviteLink = cm.invite_link?.invite_link;
    const newMember = cm.new_chat_member?.user;

    if (inviteLink && newMember && !newMember.is_bot) {
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

        // Real-time Push Alert to Affiliate
        const alertMsg = 
`🔔 *NEW FREE MEMBER JOINED VIA YOUR LINK!*

👤 *User*: ${joineeFirstName} (${joineeUsername})
📊 *Your Total Free Joinees*: ${Number(aff.total_free_joins) + 1}

_When this member purchases a Premium Plan, you will receive an instant 15%–25% commission alert!_`;

        await sendMessage(aff.telegram_id, alertMsg);
        console.log(`✅ Tracked free joinee ${joineeUsername} for affiliate ${aff.telegram_handle}`);
      }
    }
  }
}

// Helper: Render Live Stats Dashboard with Progress Bar
async function showStats(chatId, telegramId) {
  const dbRes = await queryDb(`SELECT * FROM public.affiliates WHERE telegram_id = $1`, [telegramId]);
  const aff = dbRes.rows[0];

  if (!aff) {
    await sendMessage(chatId, `⚠️ *No Partner Account Found*\n\nTap *🚀 Get My Referral Link* below to activate your partner profile instantly!`, getMainKeyboard(false));
    return;
  }

  const conversions = Number(aff.total_conversions || 0);
  const rate = Number(aff.commission_rate || 15);
  const tierInfo = getTierProgress(conversions, rate);

  const statsMsg = 
`📊 *YOUR LIVE PARTNER DASHBOARD*

👤 *Partner Name*: ${aff.first_name} (${aff.telegram_handle})
🎯 *Current Tier*: *${tierInfo.tier}*
📈 *Tier Milestone Progress*:
\`${tierInfo.bar}\`
_${tierInfo.nextGoal}_

---
👥 *Total Free Joinees*: \`${aff.total_free_joins}\`
💰 *Total VIP Conversions*: \`${conversions}\`

💵 *Total Earned*: \`$${Number(aff.total_earned).toFixed(2)} USDT\`
✅ *Total Paid Out*: \`$${Number(aff.total_paid).toFixed(2)} USDT\`
⏳ *Unpaid Balance*: \`$${Number(aff.unpaid_balance).toFixed(2)} USDT\`

---
💳 *Payout Wallet*: \`${aff.wallet_address || '⚠️ Not Set (Tap Set Payout Wallet)'}\`
🔗 *Your Link*: \`${aff.invite_link || 'Not Generated'}\``;

  await sendMessage(chatId, statsMsg, getMainKeyboard(Boolean(aff.wallet_address)));
}

// Helper: Render Promo Kit & Swipe Copy Templates
async function showPromoKit(chatId) {
  const promoMsg = 
`📢 *YAGA CALLS PROMOTIONAL CONTENT KIT & SWIPE COPY*

Use these high-converting templates across Twitter/X, Telegram channels, or Discord:

---
📲 *TEMPLATE 1: TWITTER/X POST*
\`\`\`
Stop trading crypto blind. 

If you want narrative-driven market setups with clear entry zones, invalidation levels, and strict risk management — join the Yaga Calls Free Group.

Join free here: [INSERT YOUR LINK]
\`\`\`

---
📲 *TEMPLATE 2: TELEGRAM BROADCAST POST*
\`\`\`
🔥 Looking for institutional-grade crypto signals & deep narrative research?

Yaga Calls provides high-probability setups with full entry, target, and stop-loss context.

Join the free Telegram community before the next trade setup drops:
👉 [INSERT YOUR LINK]
\`\`\`

---
💡 *KEY VALUE PROPOSITIONS TO HIGHLIGHT:*
• 85%+ verified setup accuracy with historical proof
• Full setup breakdown: Entry, Stop-Loss, Targets & Invalidation Logic
• Educational narrative market research (DeFi, AI, Layer 1s)`;

  await sendMessage(chatId, promoMsg, getMainKeyboard(true));
}

// Helper: Render Affiliate Handbook & Transparency Rules
async function showHandbook(chatId) {
  const handbookMsg = 
`📘 *YAGA CALLS AFFILIATE HANDBOOK & TRANSPARENCY RULES*

*1. 100% Native Telegram Attribution*
- Every link generated by this bot is linked permanently to your Telegram partner ID.
- Zero cookie drop-offs. When someone joins the free group via your link, they are tagged to you forever.

*2. Commission Tier Structure*
- *Tier 1 (Standard)*: 15% on all subscriptions ($44.85 to $119.85 per sale).
- *Tier 2 (Pro Creator - 10+ sales/mo)*: 20% commission ($59.80 to $159.80 per sale).
- *Tier 3 (VIP Institutional - 25+ sales/mo)*: 25% commission ($74.75 to $199.75 per sale).

*3. Ethical Promotion Code of Conduct*
✅ *DO*: Share setup breakdowns, market narrative analysis, Twitter threads, YouTube reviews, and personal trade results.
❌ *DON'T*: Spam random groups, make fake profit guarantees, impersonate Yaga Calls staff, or create self-referral accounts.

*4. Weekly Crypto Settlements*
- Settled in USDT (TRC20/ERC20), USDC, SOL, or BTC.
- Minimum payout threshold: $50 USDT.
- Issued weekly every Friday or upon request via CRM.

*5. Direct Partner Support & Queries*
- Have questions or need custom arrangements?
- ✉️ Email: \`partner@yagacalls.com\`
- 📱 Telegram: @yagacalls47`;

  await sendMessage(chatId, handbookMsg, getMainKeyboard(true));
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
_Payout will be processed according to your wallet settings on Friday._`;

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
      { command: 'stats', description: '📊 Check Live Earnings & Tier Progress' },
      { command: 'wallet', description: '💳 Set or Update Crypto Payout Wallet' },
      { command: 'promokit', description: '📢 Access Promotional Swipe Copy Kit' },
      { command: 'guide', description: '📘 Read Partner Rules & Tier Handbook' },
      { command: 'help', description: '💬 Contact VIP Partner Manager' }
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
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yaga_partner_program_bot', engine: 'Yaga Affiliate Engine V2' }));
  }

  else { res.writeHead(404); res.end(); }
});

server.listen(PORT, () => {
  console.log(`🚀 Affiliate API Engine V2 running on http://localhost:${PORT}`);
});

// Telegram Long Polling Loop
let offset = 0;
async function pollUpdates() {
  await registerBotCommands();
  console.log('🤖 Telegram Partner Program Bot V2 Active! Listening for updates...');
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
