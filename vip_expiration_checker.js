// ====================================================================
// YAGA CALLS OPERATIONS — VIP SUBSCRIPTION EXPIRATION CHECKER DAEMON
// Runs continuously on VPS to alert Owners when VIP subscriptions expire
// ====================================================================

try { require('dotenv').config(); } catch(e) {}
const { Pool } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_CONNECTION = 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DB_CONNECTION,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
});

async function runQuery(text, params = []) {
  return await pool.query(text, params);
}

async function apiCall(method, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API Error [${method}]:`, err.message);
    return { ok: false };
  }
}

async function broadcastToOwners(msgCallback) {
  try {
    const ownersRes = await runQuery(`SELECT telegram_chat_id, name FROM public.owners WHERE active = true`);
    for (const owner of ownersRes.rows) {
      if (owner.telegram_chat_id) {
        const content = typeof msgCallback === 'function' ? msgCallback(owner.name || 'Owner') : msgCallback;
        if (typeof content === 'string') {
          await apiCall('sendMessage', { chat_id: owner.telegram_chat_id, text: content, parse_mode: 'Markdown' });
        } else if (typeof content === 'object') {
          await apiCall('sendMessage', { chat_id: owner.telegram_chat_id, parse_mode: 'Markdown', ...content });
        }
      }
    }
  } catch (err) {
    console.error('Error broadcasting to owners:', err);
  }
}

async function checkVipExpirations() {
  console.log(`\n🔍 [${new Date().toISOString()}] Checking VIP Subscription Expirations...`);

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    // 1. CHECK MEMBERS EXPIRING WITHIN 7 DAYS (ACTIVE -> EXPIRING_SOON)
    const expiringRes = await runQuery(
      `SELECT * FROM public.community_members_log 
       WHERE member_tier = 'PAID_VIP' 
         AND subscription_status = 'ACTIVE'
         AND subscription_expiration_date <= $1 
         AND subscription_expiration_date > $2`,
      [sevenDaysFromNow.toISOString(), now.toISOString()]
    );

    for (const m of expiringRes.rows) {
      await runQuery(`UPDATE public.community_members_log SET subscription_status = 'EXPIRING_SOON' WHERE id = $1`, [m.id]);

      const dateStr = new Date(m.subscription_expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const handleStr = m.telegram_handle ? ` (${m.telegram_handle})` : '';

      await broadcastToOwners((ownerName) => ({
        text: `⚠️ *VIP SUBSCRIPTION EXPIRING SOON!*\n\nHi *${ownerName}*,\nMember *${m.first_name}*${handleStr} subscription will expire in **7 days**!\n\n📌 *Attributed Associate:* ${m.associate_name || 'Direct'}\n💎 *Current Package:* $${m.paid_subscription_value || 0} (${m.subscription_duration_months || 6} Months)\n⏰ *Expiration Date:* **${dateStr}**\n\n👇 *Quick Renewal:*`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Renew 6 Mos ($350)', callback_data: `vip_dur:REQ:${m.telegram_user_id}:350:6` },
              { text: '🎁 Renew 8 Mos Promo', callback_data: `vip_dur:REQ:${m.telegram_user_id}:350:8` }
            ]
          ]
        }
      }));

      console.log(`⚠️ Alerted owner: ${m.first_name} expiring on ${dateStr}`);
    }

    // 2. CHECK MEMBERS PAST EXPIRATION (EXPIRING_SOON / ACTIVE -> EXPIRED)
    const expiredRes = await runQuery(
      `SELECT * FROM public.community_members_log 
       WHERE member_tier = 'PAID_VIP' 
         AND subscription_status IN ('ACTIVE', 'EXPIRING_SOON')
         AND subscription_expiration_date <= $1`,
      [now.toISOString()]
    );

    for (const m of expiredRes.rows) {
      await runQuery(`UPDATE public.community_members_log SET subscription_status = 'EXPIRED' WHERE id = $1`, [m.id]);

      const dateStr = new Date(m.subscription_expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const handleStr = m.telegram_handle ? ` (${m.telegram_handle})` : '';

      await broadcastToOwners((ownerName) => ({
        text: `🔴 *VIP SUBSCRIPTION EXPIRED!*\n\nHi *${ownerName}*,\nMember *${m.first_name}*${handleStr} High Table VIP subscription has **EXPIRED**.\n\n📌 *Attributed Associate:* ${m.associate_name || 'Direct'}\n💎 *Expired Package:* $${m.paid_subscription_value || 0}\n⏰ *Expired On:* **${dateStr}**\n\n👇 *Action Required:*`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Renew 6 Mos ($350)', callback_data: `vip_dur:REQ:${m.telegram_user_id}:350:6` },
              { text: '🎁 Renew 8 Mos Promo', callback_data: `vip_dur:REQ:${m.telegram_user_id}:350:8` }
            ],
            [
              { text: '🎁 Renew 14 Mos Promo', callback_data: `vip_dur:REQ:${m.telegram_user_id}:700:14` }
            ]
          ]
        }
      }));

      console.log(`🔴 Alerted owner: ${m.first_name} expired on ${dateStr}`);
    }

    console.log(`✅ VIP Expiration Check Complete.`);

  } catch (err) {
    console.error('Error running VIP expiration check:', err);
  }
}

// Run immediately on boot
checkVipExpirations();

// Run every 6 hours (6 * 60 * 60 * 1000 ms)
setInterval(checkVipExpirations, 6 * 60 * 60 * 1000);
