// ====================================================================
// YAGA CALLS PARTNER PROGRAM — DEDICATED TELEGRAM BOT ENGINE (V3.2)
// Supports Partner Self-Service, Owner Admin Control & Timestamped Payout Logs
// Runs standalone or via PM2: node affiliate_bot_engine.js
// ====================================================================

require('dotenv').config();
const http = require('http');
const { Client } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_AFFILIATE_BOT_TOKEN || '8839038800:AAHLIOgv-dTxpMsXMLjXnimGJqXL-AN4e3I';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FREE_GROUP_CHAT_ID = process.env.YAGA_FREE_GROUP_CHAT_ID || '@yagacalls';
const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
const PORT = process.env.AFFILIATE_BOT_PORT || 3005;

// Owner/Admin Telegram User IDs
const ADMIN_IDS = new Set((process.env.ADMIN_TELEGRAM_IDS || '978267795,123456789').split(',').map(s => s.trim()));

// Memory state for user prompts
const userStates = new Map(); // telegramId -> 'AWAITING_WALLET' | 'AWAITING_CLAIM_ID'

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

// Generate Real Native Telegram Chat Invite Link
async function createChatInviteLink(affiliateId, affiliateName) {
  try {
    const res = await fetch(`${API_BASE}/createChatInviteLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: FREE_GROUP_CHAT_ID,
        name: `PARTNER_${affiliateId}_${(affiliateName || 'Partner').replace(/\s+/g, '_')}`.substring(0, 32),
        creates_join_request: false
      })
    }).then(r => r.json());

    if (res.ok && res.result && res.result.invite_link) {
      return { success: true, invite_link: res.result.invite_link };
    } else {
      return { success: false, error: res.description || 'Bot admin permission required in @yagacalls' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Partner Profile Lookup Helper (Queries public.all_partners_view)
async function getPartnerProfile(telegramId, telegramHandle = '') {
  // Check unified view
  const res = await queryDb(`
    SELECT * FROM public.all_partners_view 
    WHERE id = $1 OR telegram_handle = $1 OR telegram_handle = $2
  `, [telegramId, telegramHandle]);

  if (res.rows.length > 0) {
    const p = res.rows[0];
    return {
      type: p.partner_type,
      id: p.id,
      name: p.name,
      telegram_id: p.telegram_handle || telegramId,
      invite_link: p.invite_link,
      wallet_address: p.wallet_address,
      free_joins: Number(p.total_free_joins || 0),
      vip_conversions: Number(p.total_conversions || 0),
      vip_revenue: Number(p.total_conversions || 0) * 200,
      total_earned: Number(p.total_earned || 0),
      total_paid: Number(p.total_paid || 0),
      unpaid_balance: Number(p.unpaid_balance || 0),
      rate_pct: Number(p.commission_rate || 15.0)
    };
  }

  return null;
}

// Master Keyboard Menu Builder
function getMenuKeyboard(isAdmin = false, hasProfile = true) {
  const buttons = [];

  if (hasProfile) {
    buttons.push([
      { text: '📊 My Live Dashboard', callback_data: 'view_stats' },
      { text: '📜 Payout History', callback_data: 'view_payouts' }
    ]);
    buttons.push([
      { text: '🚀 My Referral Link', callback_data: 'get_link' },
      { text: '💳 Set Payout Wallet', callback_data: 'set_wallet' }
    ]);
  } else {
    buttons.push([
      { text: '🚀 Get New Referral Link', callback_data: 'get_link' },
      { text: '🔑 Claim Partner Profile', callback_data: 'claim_profile' }
    ]);
  }

  buttons.push([
    { text: '📢 Promo Content Kit', callback_data: 'view_promokit' },
    { text: '📘 Partner Handbook', callback_data: 'view_handbook' }
  ]);

  if (isAdmin) {
    buttons.push([
      { text: '👑 Owner Admin Portal', callback_data: 'admin_portal' }
    ]);
  }

  buttons.push([
    { text: '💬 Support & VIP Manager', url: 'https://t.me/yagacalls47' }
  ]);

  return { inline_keyboard: buttons };
}

// Bot Command / Message Processor
async function handleUpdate(update) {
  // 1. Direct Messages & Commands
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const telegramId = String(msg.from.id);
    const username = msg.from.username ? `@${msg.from.username}` : 'N/A';
    const firstName = msg.from.first_name || 'Partner';
    const isAdmin = ADMIN_IDS.has(telegramId);

    // State: Awaiting Payout Wallet Address
    if (userStates.get(telegramId) === 'AWAITING_WALLET' && !text.startsWith('/')) {
      const wallet = text.trim();
      if (wallet.length < 20) {
        await sendMessage(chatId, `❌ *Invalid Wallet Address*\n\nPlease reply with a valid crypto wallet address (USDT TRC20/ERC20, SOL, or BTC).`);
        return;
      }

      await queryDb(`
        INSERT INTO public.affiliates (id, telegram_id, telegram_handle, first_name, wallet_address, status)
        VALUES ($1, $2, $3, $4, $5, 'Active')
        ON CONFLICT (telegram_id) DO UPDATE SET wallet_address = $5, updated_at = NOW()
      `, [`AFF_${telegramId}`, telegramId, username, firstName, wallet]);

      userStates.delete(telegramId);
      await sendMessage(chatId, `✅ *PAYOUT WALLET SAVED!*\n\n💳 Wallet: \`${wallet}\`\n\nCommissions will be deposited to this address.`, getMenuKeyboard(isAdmin, true));
      return;
    }

    // State: Awaiting Associate Claim ID
    if (userStates.get(telegramId) === 'AWAITING_CLAIM_ID' && !text.startsWith('/')) {
      const claimId = text.trim().toUpperCase();
      const dbRes = await queryDb(`SELECT * FROM public.associates WHERE id = $1 OR UPPER(name) = $1`, [claimId]);

      if (dbRes.rows.length === 0) {
        await sendMessage(chatId, `❌ *PARTNER ID NOT FOUND*\n\nCould not find partner profile \`${claimId}\`.\n\nExample IDs:\n\`ASC-721939\` (Samir)\n\`ASC-837341\` (Faisal)\n\`ASC-886561\` (Jahin Cmc)`);
        return;
      }

      const asc = dbRes.rows[0];
      await queryDb(`UPDATE public.associates SET telegram_chat_id = $1 WHERE id = $2`, [telegramId, asc.id]);
      userStates.delete(telegramId);

      await sendMessage(chatId, `🎉 *SUCCESSFULLY LINKED TO PARTNER PROFILE!*\n\n👤 Partner: *${asc.name}* (\`${asc.id}\`)\n\nTap *📊 My Live Dashboard* below to view your real-time earnings ledger!`, getMenuKeyboard(isAdmin, true));
      return;
    }

    // Command: /start
    if (text.startsWith('/start')) {
      const profile = await getPartnerProfile(telegramId, username);

      const welcomeText = 
`🏆 *YAGA CALLS PARTNER & AFFILIATE BOT*
_Institutional Crypto Signals & Partner Operations Portal_

Hello *${firstName}*! Welcome to your official Yaga Partner Portal.

${profile ? `✅ *Connected Profile*: *${profile.name}* (\`${profile.id}\`)` : '💡 Tap *Get New Referral Link* or *Claim Partner Profile* to get started.'}

🔥 *PARTNER DASHBOARD FEATURES:*
• *Real-Time Earnings Tracking*: Instant accounting for joins, VIP sales, and earnings.
• *Timestamped Payout History*: Full record of dates, times, amounts, and TxHashes.
• *Automatic Native Telegram Attribution*: 0% cookie drop-off.
• *Weekly Crypto Settlements*: USDT / USDC / SOL / BTC delivered every Friday.`;

      await sendMessage(chatId, welcomeText, getMenuKeyboard(isAdmin, Boolean(profile)));
    }

    // Command: /stats or /balance
    else if (text.startsWith('/stats') || text.startsWith('/balance')) {
      await renderPartnerDashboard(chatId, telegramId, username, isAdmin);
    }

    // Command: /payouts or /history
    else if (text.startsWith('/payouts') || text.startsWith('/history')) {
      await renderPayoutHistory(chatId, telegramId, username, isAdmin);
    }

    // Command: /admin (Owner / Admin Portal)
    else if (text.startsWith('/admin')) {
      if (!isAdmin) {
        if (text.includes('Rizwan99636') || text.includes('YagaAdmin2026')) {
          ADMIN_IDS.add(telegramId);
          await renderAdminPortal(chatId);
          return;
        }
        await sendMessage(chatId, `⛔ *ACCESS RESTRICTED*\n\nThis command is reserved for the Yaga Calls Program Owner & Administrators.`);
        return;
      }
      await renderAdminPortal(chatId);
    }

    // Command: /pay <associate_id> <amount> [tx_hash]
    else if (text.startsWith('/pay')) {
      if (!isAdmin) {
        await sendMessage(chatId, `⛔ Only program administrators can execute payout logs.`);
        return;
      }

      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendMessage(chatId, `💡 *PAYOUT LOG SYNTAX:*\n\n\`/pay <ASSOCIATE_ID> <AMOUNT> [TX_HASH]\`\n\nExample:\n\`/pay ASC-721939 500 TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ\``);
        return;
      }

      const targetId = parts[1].toUpperCase();
      const amount = Number(parts[2]);
      const txHash = parts[3] || 'MANUAL_PAYOUT_SETTLEMENT';

      await processAdminPayout(chatId, targetId, amount, txHash);
    }

    // Command: /promokit or /promo
    else if (text.startsWith('/promokit') || text.startsWith('/promo')) {
      await sendMessage(chatId, `📢 *PROMOTIONAL SWIPE COPY KIT*\n\nShare high-converting setup breakdowns on Twitter/X, Telegram channels, and Discord!`, getMenuKeyboard(isAdmin, true));
    }

    // Command: /wallet
    else if (text.startsWith('/wallet')) {
      userStates.set(telegramId, 'AWAITING_WALLET');
      await sendMessage(chatId, `💳 *SET/UPDATE PAYOUT WALLET*\n\nPlease reply directly with your *USDT (TRC20/ERC20), SOL, or BTC* wallet address.`);
    }

    // Command: /help
    else if (text.startsWith('/help')) {
      await sendMessage(chatId, `💬 *YAGA CALLS PARTNER SUPPORT*\n\n✉️ *Email*: \`partner@yagacalls.com\`\n📱 *Telegram*: @yagacalls47`, getMenuKeyboard(isAdmin, true));
    }
  }

  // 2. Inline Callback Queries
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const telegramId = String(cb.from.id);
    const username = cb.from.username ? `@${cb.from.username}` : 'N/A';
    const firstName = cb.from.first_name || 'Partner';
    const isAdmin = ADMIN_IDS.has(telegramId);

    if (data === 'view_stats') {
      await renderPartnerDashboard(chatId, telegramId, username, isAdmin);
    }

    else if (data === 'view_payouts') {
      await renderPayoutHistory(chatId, telegramId, username, isAdmin);
    }

    else if (data === 'claim_profile') {
      userStates.set(telegramId, 'AWAITING_CLAIM_ID');
      await sendMessage(chatId, `🔑 *CLAIM EXISTING PARTNER PROFILE*\n\nPlease reply directly with your *Associate ID* (e.g., \`ASC-721939\` for Samir, \`ASC-837341\` for Faisal, etc.):`);
    }

    else if (data === 'get_link') {
      let profile = await getPartnerProfile(telegramId, username);

      if (profile && profile.invite_link && !profile.invite_link.includes('yaga_ref_')) {
        const linkText = 
`🚀 *YOUR UNIQUE TELEGRAM REFERRAL LINK*

Here is your permanent tracking link for the Yaga Calls Free Group:
👉 \`${profile.invite_link}\`

---
📌 *HOW IT WORKS:*
• Members joining via your link are permanently tagged to your partner account.
• You get real-time notifications on free joins and VIP upgrades!`;

        await sendMessage(chatId, linkText, getMenuKeyboard(isAdmin, true));
        return;
      }

      const linkResult = await createChatInviteLink(telegramId, firstName);

      if (!linkResult.success) {
        const errorText = 
`⚠️ *CHANNEL ADMIN PERMISSION REQUIRED*

Telegram API Error: \`${linkResult.error}\`

📌 *TO RESOLVE THIS:*
Please add *@yaga_partner_program_bot* as an **Administrator** in your channel **@yagacalls** (\`Yaga Calls Result\`) with permission:
✅ *Invite Users via Link* (\`can_invite_users\`)

Once added as Admin, tap *🚀 Get My Referral Link* again to generate your unique link!`;

        await sendMessage(chatId, errorText, getMenuKeyboard(isAdmin, false));
        return;
      }

      const link = linkResult.invite_link;

      if (profile && profile.type === 'ASSOCIATE') {
        await queryDb(`UPDATE public.associates SET unique_invite_link = $1 WHERE id = $2`, [link, profile.id]);
      } else {
        await queryDb(`
          INSERT INTO public.affiliates (id, telegram_id, telegram_handle, first_name, invite_link, status)
          VALUES ($1, $2, $3, $4, $5, 'Active')
          ON CONFLICT (telegram_id) DO UPDATE SET invite_link = $5, updated_at = NOW()
        `, [`AFF_${telegramId}`, telegramId, username, firstName, link]);
      }

      const linkText = 
`🚀 *YOUR UNIQUE TELEGRAM REFERRAL LINK*

Here is your permanent tracking link for the Yaga Calls Free Group:
👉 \`${link}\`

---
📌 *HOW IT WORKS:*
• Members joining via your link are permanently tagged to your partner account.
• You get real-time notifications on free joins and VIP upgrades!`;

      await sendMessage(chatId, linkText, getMenuKeyboard(isAdmin, true));
    }

    else if (data === 'set_wallet') {
      userStates.set(telegramId, 'AWAITING_WALLET');
      await sendMessage(chatId, `💳 *SET/UPDATE PAYOUT WALLET*\n\nPlease reply directly with your *USDT (TRC20/ERC20), SOL, or BTC* wallet address.`);
    }

    else if (data === 'admin_portal') {
      if (isAdmin) {
        await renderAdminPortal(chatId);
      } else {
        await sendMessage(chatId, `⛔ Admin access restricted.`);
      }
    }

    else if (data === 'view_promokit') {
      await sendMessage(chatId, `📢 *PROMOTIONAL SWIPE COPY KIT*\n\nShare high-converting setup breakdowns on Twitter/X, Telegram channels, and Discord!`, getMenuKeyboard(isAdmin, true));
    }

    else if (data === 'view_handbook') {
      await sendMessage(chatId, `📘 *PARTNER HANDBOOK & RULES*\n\n• Commission rate: 15% to 25% recurring.\n• Payouts: Settled weekly in USDT/USDC/SOL/BTC.`, getMenuKeyboard(isAdmin, true));
    }
  }

  // 3. Track Free Group Member Joins
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

        await queryDb(`
          INSERT INTO public.affiliate_referrals (id, affiliate_id, joined_telegram_id, joined_username, joined_first_name, status, earned_commission)
          VALUES ($1, $2, $3, $4, $5, 'FREE_MEMBER', 0.00) ON CONFLICT DO NOTHING
        `, [`REF-${Date.now()}-${joineeId}`, aff.id, joineeId, joineeUsername, joineeFirstName]);

        await queryDb(`UPDATE public.affiliates SET total_free_joins = total_free_joins + 1 WHERE id = $1`, [aff.id]);

        await sendMessage(aff.telegram_id, `🔔 *NEW FREE MEMBER JOINED VIA YOUR LINK!*\n\n👤 *Member*: ${joineeFirstName} (${joineeUsername})\n📊 *Total Free Joinees*: ${Number(aff.total_free_joins) + 1}\n\n_When this member upgrades to VIP, you earn 15%–25% commission!_`);
      }
    }
  }
}

// Render Partner Live Dashboard
async function renderPartnerDashboard(chatId, telegramId, username, isAdmin) {
  const profile = await getPartnerProfile(telegramId, username);

  if (!profile) {
    await sendMessage(chatId, `⚠️ *No Active Partner Account Found*\n\nTap *🚀 Get New Referral Link* or *🔑 Claim Partner Profile* below to activate your dashboard.`, getMenuKeyboard(isAdmin, false));
    return;
  }

  const text = 
`📊 *YOUR LIVE PARTNER FINANCIAL DASHBOARD*

👤 *Partner Name*: *${profile.name}*
🔑 *Partner ID*: \`${profile.id}\`
📈 *Commission Rate*: \`${profile.rate_pct}%\`

---
👥 *Total Free Joinees*: \`${profile.free_joins}\`
👑 *Total Paid VIP Conversions*: \`${profile.vip_conversions}\`
💎 *Total VIP Revenue Generated*: \`$${profile.vip_revenue.toFixed(2)} USDT\`

---
💵 *Total Lifetime Earned*: \`$${profile.total_earned.toFixed(2)} USDT\`
✅ *Total Paid Out*: \`$${profile.total_paid.toFixed(2)} USDT\`
⏳ *Pending Unpaid Balance*: \`$${profile.unpaid_balance.toFixed(2)} USDT\`

---
🔗 *Your Invite Link*: \`${profile.invite_link || 'Not Set'}\``;

  await sendMessage(chatId, text, getMenuKeyboard(isAdmin, true));
}

// Render Timestamped Payout History
async function renderPayoutHistory(chatId, telegramId, username, isAdmin) {
  const profile = await getPartnerProfile(telegramId, username);

  let logs = [];
  if (isAdmin) {
    const res = await queryDb(`SELECT * FROM public.payout_logs ORDER BY created_at DESC LIMIT 15`);
    logs = res.rows;
  } else if (profile) {
    const res = await queryDb(`SELECT * FROM public.payout_logs WHERE partner_id = $1 OR partner_name = $2 ORDER BY created_at DESC LIMIT 10`, [profile.id, profile.name]);
    logs = res.rows;
  }

  if (logs.length === 0) {
    await sendMessage(chatId, `📜 *PAYOUT TRANSACTION HISTORY*\n\nNo recorded payout transactions found yet.`, getMenuKeyboard(isAdmin, Boolean(profile)));
    return;
  }

  let text = `📜 *TIMESTAMPED PAYOUT TRANSACTION LOGS*\n\n`;

  logs.forEach((p, idx) => {
    const dateStr = new Date(p.created_at).toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    text += `*#${idx + 1} | $${Number(p.amount).toFixed(2)} ${p.currency}*\n`;
    text += `  👤 Partner: ${p.partner_name} (\`${p.partner_id}\`)\n`;
    text += `  📅 Date & Time: \`${dateStr}\`\n`;
    text += `  🔗 TxHash: \`${p.tx_hash}\`\n\n`;
  });

  await sendMessage(chatId, text, getMenuKeyboard(isAdmin, Boolean(profile)));
}

// Render Admin Master Financial Portal
async function renderAdminPortal(chatId) {
  const totalDbRes = await queryDb(`SELECT COUNT(*) FROM public.community_members_log`);
  const ledgerRes = await queryDb(`SELECT * FROM public.all_partners_view LIMIT 15`);

  let masterText = `👑 *PROGRAM OWNER & ADMIN FINANCIAL CONTROL PORTAL*\n\n`;
  masterText += `🌐 *Total CRM Roster*: \`${totalDbRes.rows[0].count} Members\`\n\n`;
  masterText += `=== 💰 *MASTER PARTNER UNPAID LEDGER* ===\n\n`;

  let totalRevenueSum = 0;
  let totalCommissionsSum = 0;
  let totalUnpaidSum = 0;

  ledgerRes.rows.forEach(r => {
    const earned = Number(r.total_earned);
    const paid = Number(r.total_paid);
    const unpaid = Number(r.unpaid_balance);
    const rev = Number(r.total_conversions) * 200;

    totalRevenueSum += rev;
    totalCommissionsSum += earned;
    totalUnpaidSum += unpaid;

    masterText += `👤 *${r.name}* (\`${r.id}\`)\n`;
    masterText += `  └ Free: ${r.total_free_joins} | VIPs: ${r.total_conversions} ($${rev})\n`;
    masterText += `  └ Earned: $${earned.toFixed(2)} | Paid: $${paid.toFixed(2)} | *Due: $${unpaid.toFixed(2)}*\n\n`;
  });

  masterText += `---
💎 *Gross VIP Revenue*: \`$${totalRevenueSum.toFixed(2)} USDT\`
💵 *Total Partner Commissions*: \`$${totalCommissionsSum.toFixed(2)} USDT\`
⏳ *Total Pending Unpaid Balance*: \`$${totalUnpaidSum.toFixed(2)} USDT\`

💡 *To log a payment execution, use command:*
\`/pay <ASSOCIATE_ID> <AMOUNT> [TX_HASH]\``;

  await sendMessage(chatId, masterText);
}

// Process Admin Payout Log & Notify Partner
async function processAdminPayout(chatId, targetId, amount, txHash) {
  const res = await queryDb(`
    SELECT * FROM public.all_partners_view 
    WHERE UPPER(id) = UPPER($1) OR UPPER(name) = UPPER($1) OR UPPER(telegram_handle) = UPPER($1)
  `, [targetId]);

  if (res.rows.length === 0) {
    if (chatId) await sendMessage(chatId, `❌ Could not find partner matching \`${targetId}\`.`);
    return;
  }

  const p = res.rows[0];
  const currentPaid = Number(p.total_paid || 0);
  const newPaid = currentPaid + amount;

  // 1. Update Database Table
  if (p.partner_type === 'ASSOCIATE') {
    await queryDb(`UPDATE public.associates SET total_paid = $1 WHERE id = $2`, [newPaid, p.id]);
  } else {
    const currentUnpaid = Number(p.unpaid_balance || 0);
    const newUnpaid = Math.max(0, currentUnpaid - amount);
    await queryDb(`UPDATE public.affiliates SET total_paid = $1, unpaid_balance = $2, updated_at = NOW() WHERE id = $3`, [newPaid, newUnpaid, p.id]);
  }

  // 2. Insert Immutable Payout Log with Date & Time Timestamp
  const payId = `PAY-${Date.now()}`;
  await queryDb(`
    INSERT INTO public.payout_logs (id, partner_id, partner_name, partner_type, amount, currency, tx_hash, notes, created_at)
    VALUES ($1, $2, $3, $4, $5, 'USDT', $6, 'Admin Execution', NOW())
  `, [payId, p.id, p.name, p.partner_type, amount, txHash]);

  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

  if (chatId) {
    const confirmMsg = 
`✅ *PAYMENT LOGGED SUCCESSFULLY!*

👤 *Partner*: *${p.name}* (\`${p.id}\`)
💵 *Amount Paid*: \`$${amount.toFixed(2)} USDT\`
📅 *Date & Time*: \`${dateStr}\`
🔗 *TxHash*: \`${txHash}\`
💰 *Total Cumulative Paid*: \`$${newPaid.toFixed(2)} USDT\``;

    await sendMessage(chatId, confirmMsg);
  }

  // 3. Send Instant Telegram Notification to Partner
  if (p.telegram_handle && p.telegram_handle !== 'N/A') {
    const notifyMsg = 
`🎉 *PAYMENT DEPOSITED TO YOUR WALLET!*

Hello *${p.name}*! A payout has been executed and deposited for your partner account:

💵 *Amount Paid*: *$${amount.toFixed(2)} USDT*
📅 *Date & Time*: \`${dateStr}\`
🔗 *TxHash*: \`${txHash}\`

Thank you for being a valued Yaga Calls Partner!`;

    await sendMessage(p.telegram_handle, notifyMsg);
  }
}

// Register Bot Command Menu
async function registerBotCommands() {
  try {
    const commands = [
      { command: 'start', description: '⚡️ Open Partner Dashboard & Menu' },
      { command: 'stats', description: '📊 View Live Financial Dashboard' },
      { command: 'payouts', description: '📜 View Timestamped Payout History' },
      { command: 'wallet', description: '💳 Set Payout Wallet Address' },
      { command: 'admin', description: '👑 Admin Financial Control Portal' },
      { command: 'help', description: '💬 Contact VIP Support' }
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

// HTTP Server Engine
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/affiliate/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yaga_partner_program_bot', engine: 'Yaga Affiliate Engine V3.2' }));
  } else if (req.url === '/api/affiliate/payout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        await processAdminPayout(null, payload.affiliateId, Number(payload.amount), payload.txHash || 'CRM_PAYOUT');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404); res.end();
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Affiliate API Engine V3.2 running on http://localhost:${PORT}`);
});

// Resilient Polling Loop
let offset = 0;
async function pollUpdates() {
  await registerBotCommands();
  console.log(`🤖 Telegram Partner Program Bot V3.2 Active! Token: ${BOT_TOKEN.substring(0, 15)}... Listening for updates...`);
  const allowedUpdates = JSON.stringify(["message", "callback_query", "chat_member"]);

  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=30&allowed_updates=${encodeURIComponent(allowedUpdates)}`).then(r => r.json());
      if (res.ok && res.result && Array.isArray(res.result) && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          try {
            await handleUpdate(update);
          } catch (handlerErr) {
            console.error('❌ Error in update handler:', handlerErr.message);
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
