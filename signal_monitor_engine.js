const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

try { require('dotenv').config(); } catch(e) {}
const { Pool } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DB_CONNECTION,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

async function runQuery(text, params = []) {
  return await pool.query(text, params);
}

async function apiCall(method, payload = {}) {
  if (!BOT_TOKEN) return { ok: false };
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

async function broadcastToOwners(messageText, options = {}) {
  try {
    const threadId = typeof options === 'object' ? options.threadId : options;
    const targetThreadId = threadId || process.env.TG_THREAD_SIGNALS || 2;
    const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID || '-1004498264496';

    if (supergroupId) {
      const payload = {
        chat_id: supergroupId,
        text: messageText,
        parse_mode: 'HTML'
      };
      if (targetThreadId) {
        payload.message_thread_id = parseInt(targetThreadId, 10);
      }
      await apiCall('sendMessage', payload);
    }

    const res = await runQuery(`SELECT telegram_chat_id, name FROM public.owners WHERE telegram_chat_id IS NOT NULL AND active = true`);
    for (const owner of res.rows) {
      if (owner.telegram_chat_id && owner.telegram_chat_id !== supergroupId) {
        await apiCall('sendMessage', {
          chat_id: owner.telegram_chat_id,
          text: messageText,
          parse_mode: 'HTML'
        });
      }
    }
  } catch (err) {
    console.error('broadcastToOwners error:', err.message);
  }
}

// In-memory 2-minute notification queue:
// Key: signal.id, Value: { signalId, newStatus, hitType, symbol, direction, leverage, livePrice, code, triggerTime }
const pendingAlerts = new Map();

async function fetchLivePrices(pairs) {
  if (!pairs || pairs.length === 0) return {};
  const prices = {};
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const pairSet = new Set(pairs.map(p => p.toUpperCase()));
        data.forEach(item => {
          if (pairSet.has(item.symbol.toUpperCase())) {
            prices[item.symbol.toUpperCase()] = parseFloat(item.price);
          }
        });
      }
    }
  } catch (err) {
    console.error("Failed to fetch live prices from Binance:", err.message);
  }
  return prices;
}

async function checkActiveSignals() {
  try {
    const res = await runQuery(
      `SELECT * FROM public.crypto_signals WHERE status IN ('ACTIVE', 'HIT_TP1', 'HIT_TP2') ORDER BY created_at ASC`
    );

    const activeSignals = res.rows;
    if (activeSignals.length === 0) return;

    const pairs = Array.from(new Set(activeSignals.map(s => s.pair || `${s.symbol}USDT`)));
    const prices = await fetchLivePrices(pairs);

    const now = Date.now();

    for (const sig of activeSignals) {
      const pairKey = (sig.pair || `${sig.symbol}USDT`).toUpperCase();
      const currentPrice = prices[pairKey];
      if (!currentPrice || isNaN(currentPrice)) continue;

      const isLong = (sig.direction || '').toUpperCase() === 'LONG';
      const entryPrice = parseFloat(sig.entry_price);
      const stopLoss = parseFloat(sig.stop_loss);
      const tp1 = parseFloat(sig.tp1);
      const tp2 = parseFloat(sig.tp2);
      const tp3 = parseFloat(sig.tp3);
      const status = sig.status;

      let detectedHit = null;
      let newStatus = null;

      if (isLong) {
        if (currentPrice >= tp3 && status !== 'HIT_TP3') {
          detectedHit = 'TP3';
          newStatus = 'HIT_TP3';
        } else if (currentPrice >= tp2 && status !== 'HIT_TP2' && status !== 'HIT_TP3') {
          detectedHit = 'TP2';
          newStatus = 'HIT_TP2';
        } else if (currentPrice >= tp1 && status === 'ACTIVE') {
          detectedHit = 'TP1';
          newStatus = 'HIT_TP1';
        } else if (currentPrice <= stopLoss && status !== 'HIT_SL') {
          detectedHit = 'SL';
          newStatus = 'HIT_SL';
        }
      } else {
        // SHORT
        if (currentPrice <= tp3 && status !== 'HIT_TP3') {
          detectedHit = 'TP3';
          newStatus = 'HIT_TP3';
        } else if (currentPrice <= tp2 && status !== 'HIT_TP2' && status !== 'HIT_TP3') {
          detectedHit = 'TP2';
          newStatus = 'HIT_TP2';
        } else if (currentPrice <= tp1 && status === 'ACTIVE') {
          detectedHit = 'TP1';
          newStatus = 'HIT_TP1';
        } else if (currentPrice >= stopLoss && status !== 'HIT_SL') {
          detectedHit = 'SL';
          newStatus = 'HIT_SL';
        }
      }

      if (detectedHit && newStatus) {
        const queueKey = `${sig.id}_${newStatus}`;
        if (!pendingAlerts.has(queueKey)) {
          console.log(`🎯 DETECTED ${detectedHit} hit for ${sig.symbol} (${sig.signal_code || sig.id}) at price ${currentPrice}. Buffering alert for 2 minutes...`);
          pendingAlerts.set(queueKey, {
            signalId: sig.id,
            symbol: sig.symbol,
            direction: sig.direction,
            leverage: sig.leverage,
            entryPrice,
            tp1, tp2, tp3, stopLoss,
            livePrice: currentPrice,
            signalCode: sig.signal_code || '#YG-0000',
            hitType: detectedHit,
            newStatus,
            createdAt: sig.created_at,
            triggerTime: now
          });
        }
      }
    }

    // Process buffered 2-minute alerts
    const BUFFER_MS = 2 * 60 * 1000; // 2 Minutes
    for (const [key, item] of pendingAlerts.entries()) {
      if (now - item.triggerTime >= BUFFER_MS) {
        try {
          // Update DB Status
          await runQuery(
            `UPDATE public.crypto_signals SET status = $1, updated_at = NOW() WHERE id = $2`,
            [item.newStatus, item.signalId]
          );

          // Calculate Total Duration
          const createdTime = new Date(item.createdAt || Date.now());
          const diffMs = Math.max(0, now - createdTime.getTime());
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const durationStr = diffDays >= 1 ? `${diffDays} Day${diffDays > 1 ? 's' : ''}` : `< 1 Day`;

          const cleanCode = item.signalCode.replace('#', '');
          const onlineLink = `https://signal-studio.yagacalls.com/result-view?code=${cleanCode}`;

          // Build Telegram HTML Message
          let msg = "";
          if (item.hitType === 'SL') {
            msg = `🛑 <b>STOP LOSS HIT</b>\n\n`;
            msg += `<b>$${item.symbol}</b> · <b>${item.direction}</b> · <b>${item.leverage}</b>\n`;
            msg += `⚡ Current Price <b>${item.livePrice}</b>\n\n`;
            msg += `📍 <b>Entry Price (≈):</b> ${item.entryPrice}\n`;
            msg += `🛑 <b>Stop Loss:</b> ${item.stopLoss} (Hit)\n\n`;
            msg += `⏳ Total Duration: <b>${durationStr}</b>\n\n`;
            msg += `🔗 <b>View Result Chart Online:</b> ${onlineLink}\n\n`;
            msg += `📌 <b>${item.signalCode}</b>`;
          } else {
            msg = `🎯 <b>TAKE PROFIT ${item.hitType} HIT!</b>\n\n`;
            msg += `<b>$${item.symbol}</b> · <b>${item.direction}</b> · <b>${item.leverage}</b>\n`;
            msg += `⚡ Current Price <b>${item.livePrice}</b>\n\n`;
            msg += `📍 <b>Entry Price (≈):</b> ${item.entryPrice}\n`;
            msg += `🎯 <b>TP1:</b> ${item.tp1} ${item.hitType === 'TP1' || item.hitType === 'TP2' || item.hitType === 'TP3' ? '✅' : ''}\n`;
            msg += `🎯 <b>TP2:</b> ${item.tp2} ${item.hitType === 'TP2' || item.hitType === 'TP3' ? '✅' : ''}\n`;
            msg += `🎯 <b>TP3:</b> ${item.tp3} ${item.hitType === 'TP3' ? '✅' : ''}\n`;
            msg += `🛑 <b>Stop Loss:</b> ${item.stopLoss}\n\n`;
            msg += `⏳ Total Duration: <b>${durationStr}</b>\n\n`;
            msg += `🔗 <b>View Result Chart Online:</b> ${onlineLink}\n\n`;
            msg += `📌 <b>${item.signalCode}</b>`;
          }

          console.log(`📢 DISPATCHING 2-min buffered alert for ${item.symbol} (${item.signalCode}): ${item.hitType}`);
          await broadcastToOwners(msg);

          pendingAlerts.delete(key);
        } catch (dbErr) {
          console.error(`Failed to process alert for ${key}:`, dbErr.message);
        }
      }
    }

  } catch (err) {
    console.error("Signal monitor loop error:", err.message);
  }
}

console.log("⚡ YagaCalls Automated Signal Monitor Engine Started (Polling every 15s, 2-min buffered alerts)...");

// Run monitor loop every 15 seconds
setInterval(checkActiveSignals, 15000);
checkActiveSignals();
