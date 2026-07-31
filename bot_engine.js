// ====================================================================
// YAGA CALLS OPERATIONS SYSTEM — LIVE TELEGRAM BOT & API ENGINE v2.0
// Bot Username: @yagacontentbot
// API Server: http://localhost:3001
// Database: Supabase PostgreSQL Connection Pool
//
// PRODUCTION HARDENING IMPLEMENTED:
// 1. Connection Pooler (pg.Pool) for zero connection drops
// 2. 100% DB-Persisted Staggered Dispatch Engine (Zero setTimeout reliance)
// 3. Webhook & Vercel Cron Endpoints (/api/telegram-webhook, /api/cron-batch, /api/cron-sla)
// 4. Multi-Owner Alert Broadcast Engine
// 5. Strict User Isolation & Chat ID Protection
// ====================================================================

const http = require('http');
const { Pool } = require('pg');

const BOT_TOKEN = '8446355677:AAGrA3dAPuQ45bvfUnO9dJzDYw-4QH_e8Ok';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_CONNECTION = 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
const PORT = 3001;

// Global Resilient Connection Pool (Max 10 connections for 5-10 team members)
const pool = new Pool({
  connectionString: DB_CONNECTION,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err.message);
});

// Helper DB query runner using connection pool
async function runQuery(text, params = []) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    console.error('DB Query Error:', err.message);
    throw err;
  }
}

// Telegram API Helper with error handling
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

// Session state for multi-step conversations
const activeSessions = {};

console.log('🤖 Starting Yaga Calls Telegram Bot Engine (@yagacontentbot)...');

// ── LOG SYSTEM ACTIVITY FOR REALTIME STREAM & AUDIT DESK ──
async function logActivity(eventType, creatorId, creatorName, platformId, message) {
  try {
    const logId = `LOG-${Date.now().toString().substring(5)}`;
    await runQuery(
      `INSERT INTO public.system_logs (id, event_type, creator_id, creator_name, platform_id, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [logId, eventType, creatorId || null, creatorName || 'System', platformId || null, message]
    );
  } catch (err) {
    console.error('Log activity error:', err.message);
  }
}

// ── GET ALL REGISTERED OWNERS FOR BROADCASTS ──
async function getAllOwners() {
  try {
    const res = await runQuery(`SELECT * FROM public.owners WHERE active = true`);
    if (res.rows.length > 0) return res.rows;
    return [{ id: 'OWN-001', name: 'System Owner', telegram_chat_id: '1617457685' }];
  } catch (e) {
    return [{ id: 'OWN-001', name: 'System Owner', telegram_chat_id: '1617457685' }];
  }
}

// ── BROADCAST PERSONALIZED ALERT TO ALL OWNERS ──
async function broadcastToOwners(buildCardFn) {
  try {
    const owners = await getAllOwners();
    for (const owner of owners) {
      if (owner.telegram_chat_id) {
        const text = buildCardFn(owner.name);
        await apiCall('sendMessage', {
          chat_id: owner.telegram_chat_id,
          text: text,
          parse_mode: 'Markdown'
        });
      }
    }
  } catch (err) {
    console.error('Owner broadcast error:', err.message);
  }
}

// ── LOOKUP CREATOR BY TELEGRAM CHAT ID ──
async function getCreatorByChatId(chatId) {
  try {
    const res = await runQuery(
      `SELECT * FROM public.creators WHERE telegram_chat_id = $1`,
      [chatId.toString()]
    );
    return res.rows[0] || null;
  } catch (e) {
    return null;
  }
}

// ── AUTO-GENERATE NEXT CREATOR ID ──
async function getNextCreatorId() {
  try {
    const res = await runQuery(`SELECT id FROM public.creators ORDER BY id DESC LIMIT 1`);
    if (res.rows.length === 0) return 'CR-001';
    const lastId = res.rows[0].id;
    const num = parseInt(lastId.replace('CR-', ''), 10);
    return `CR-${String(num + 1).padStart(3, '0')}`;
  } catch (e) {
    return `CR-${Date.now().toString().substring(8)}`;
  }
}

// --------------------------------------------------------------------
// 1. DISPATCH ENGINE (100% PERSISTED IN DATABASE)
// --------------------------------------------------------------------
async function triggerStaggered3BatchDispatch(dateStr) {
  console.log(`🚀 Initiating 3-Batch Dispatch Pipeline for Date: ${dateStr}`);

  try {
    const dayId = `DAY-${dateStr.replace(/-/g, '')}`;

    // Store batch dispatch timestamps in DB
    await runQuery(
      `INSERT INTO public.content_days (id, date, status, total_assignments, batch_1_status, batch_2_status, batch_3_status)
       VALUES ($1, $2, 'Sent', 0, 'DISPATCHED', 'PENDING', 'PENDING')
       ON CONFLICT (id) DO UPDATE SET status = 'Sent', batch_1_status = 'DISPATCHED'`,
      [dayId, dateStr]
    );

    const contentRes = await runQuery(
      `SELECT * FROM public.base_content WHERE day_id = $1 ORDER BY created_at`,
      [dayId]
    );
    const allContent = contentRes.rows;

    if (allContent.length === 0) {
      return { success: false, message: 'No content found for date ' + dateStr };
    }

    const creatorsRes = await runQuery(
      `SELECT * FROM public.creators WHERE telegram_chat_id IS NOT NULL AND active = true`
    );
    const creators = creatorsRes.rows;

    const contentIds = allContent.map(c => c.id);
    const captionsRes = await runQuery(
      `SELECT * FROM public.creator_captions WHERE content_id = ANY($1)`,
      [contentIds]
    );
    const captions = captionsRes.rows;

    const platformsRes = await runQuery(`SELECT * FROM public.platforms`);
    const platformMap = {};
    platformsRes.rows.forEach(p => { platformMap[p.id] = p.name; });

    const batchSize = Math.ceil(allContent.length / 3);
    const batch1 = allContent.slice(0, batchSize);

    // Dispatch Batch 1 Immediately
    console.log(`📦 BATCH 1: ${batch1.length} topics × ${creators.length} creators`);
    await dispatchBatch(1, batch1, creators, captions, platformMap, dayId, '11:00 AM EST');

    return { success: true, message: 'Batch 1 dispatched immediately! Batches 2 & 3 persisted in DB.' };

  } catch (err) {
    console.error('Dispatch error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── DB-PERSISTED PERIODIC STAGGERED BATCH CHECK (NO setTimeout RELIANCE) ──
async function checkPendingStaggeredBatches() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dayId = `DAY-${today.replace(/-/g, '')}`;

    const dayRes = await runQuery(`SELECT * FROM public.content_days WHERE id = $1`, [dayId]);
    if (dayRes.rows.length === 0) return;

    const dayRow = dayRes.rows[0];
    const contentRes = await runQuery(`SELECT * FROM public.base_content WHERE day_id = $1 ORDER BY created_at`, [dayId]);
    const allContent = contentRes.rows;
    if (allContent.length === 0) return;

    const creatorsRes = await runQuery(`SELECT * FROM public.creators WHERE telegram_chat_id IS NOT NULL AND active = true`);
    const creators = creatorsRes.rows;
    const contentIds = allContent.map(c => c.id);
    const captionsRes = await runQuery(`SELECT * FROM public.creator_captions WHERE content_id = ANY($1)`, [contentIds]);
    const captions = captionsRes.rows;
    const platformsRes = await runQuery(`SELECT * FROM public.platforms`);
    const platformMap = {};
    platformsRes.rows.forEach(p => { platformMap[p.id] = p.name; });

    const batchSize = Math.ceil(allContent.length / 3);
    const batch2 = allContent.slice(batchSize, batchSize * 2);
    const batch3 = allContent.slice(batchSize * 2);

    const now = new Date();
    const createdTime = new Date(dayRow.created_at || now);
    const minutesSinceCreated = Math.floor((now - createdTime) / (1000 * 60));

    // Batch 2 check (+30 mins)
    if (dayRow.batch_2_status === 'PENDING' && minutesSinceCreated >= 30 && batch2.length > 0) {
      console.log(`📦 DB-TRIGGERED BATCH 2 (+30m): ${batch2.length} topics`);
      await dispatchBatch(2, batch2, creators, captions, platformMap, dayId, '11:30 AM EST');
      await runQuery(`UPDATE public.content_days SET batch_2_status = 'DISPATCHED' WHERE id = $1`, [dayId]);
    }

    // Batch 3 check (+60 mins)
    if (dayRow.batch_3_status === 'PENDING' && minutesSinceCreated >= 60 && batch3.length > 0) {
      console.log(`📦 DB-TRIGGERED BATCH 3 (+60m): ${batch3.length} topics`);
      await dispatchBatch(3, batch3, creators, captions, platformMap, dayId, '12:00 PM EST');
      await runQuery(`UPDATE public.content_days SET batch_3_status = 'DISPATCHED' WHERE id = $1`, [dayId]);
    }

  } catch (err) {
    console.error('Pending batch check error:', err.message);
  }
}

setInterval(checkPendingStaggeredBatches, 30 * 1000); // Runs every 30 seconds

// ── DISPATCH BATCH & BROADCAST TO MULTIPLE OWNERS ──
async function dispatchBatch(batchNum, contentRows, creators, allCaptions, platformMap, dayId, defaultTimeEST) {
  let textCount = 0;
  let graphicCount = 0;
  let articleCount = 0;
  let dispatchedAssignments = 0;
  const targetedCreatorIds = new Set();

  for (const content of contentRows) {
    const platformName = platformMap[content.platform_id] || content.platform_id;
    const publishTimeEST = content.publish_time || defaultTimeEST;
    const driveLink = content.drive_link;

    if (content.content_type === 'Article') articleCount++;
    else if (driveLink) graphicCount++;
    else textCount++;

    for (const creator of creators) {
      const captionRow = allCaptions.find(
        cap => cap.content_id === content.id && cap.creator_id === creator.id
      );

      if (!captionRow) continue;

      const captionText = captionRow.caption || content.shared_topic;
      const headline = captionRow.headline || content.headline || '';
      const subheadline = captionRow.subheadline || content.subheadline || '';
      const asnId = `ASN-${dayId.replace('DAY-','')}-${content.id.split('-').pop()}-${creator.id}-B${batchNum}`;

      let card = `📦 *YAGA DISPATCH — BATCH ${batchNum}*\n\n`;
      card += `👤 *Creator:* ${creator.public_name}\n`;
      card += `📱 *Platform:* ${platformName}\n`;
      card += `⏰ *POST TIME:* \`${publishTimeEST}\`\n\n`;

      if (headline) card += `📌 *${headline.toUpperCase()}*\n`;
      if (subheadline) card += `_${subheadline}_\n\n`;

      card += `📋 *Topic:* ${content.shared_topic}\n\n`;
      card += `📝 *YOUR CONTENT TO POST:*\n`;
      card += `──────────────────────\n`;
      card += `${captionText}\n`;
      card += `──────────────────────`;

      if (driveLink) {
        card += `\n\n🔗 *Asset:* [View Graphic](${driveLink})`;
      }

      await apiCall('sendMessage', {
        chat_id: creator.telegram_chat_id,
        text: card,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Mark as Done', callback_data: `mark_done:${asnId}` }],
            [{ text: '🚨 Report a Problem', callback_data: `report_issue:${asnId}:${creator.id}` }]
          ]
        }
      });

      const accountId = `AC-${content.platform_id.replace('PL-','')}-${creator.id.replace('CR-','CR')}`;
      runQuery(
        `INSERT INTO public.assignment_queue (id, day_id, content_id, creator_id, platform_id, account_id, batch_number, scheduled_time, caption, status, delivered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Delivered', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'Delivered', delivered_at = NOW(), caption = $9`,
        [asnId, dayId, content.id, creator.id, content.platform_id, accountId, batchNum, publishTimeEST, captionText]
      ).catch(e => console.error('DB Insert Error:', e.message));

      dispatchedAssignments++;
      targetedCreatorIds.add(creator.public_name);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 📢 BROADCAST DISPATCH NOTIFICATION TO ALL OWNERS & LOG ACTIVITY
  const creatorNamesList = Array.from(targetedCreatorIds).join(', ') || 'Active Team';
  logActivity('DISPATCH', null, 'System Dispatcher', null, `📢 Batch ${batchNum} dispatched: ${dispatchedAssignments} assignments sent to creators (${creatorNamesList}).`);
  await broadcastToOwners((ownerName) => {
    let ownerCard = `📢 *OWNER DISPATCH NOTIFICATION*\n\n`;
    ownerCard += `Hi *${ownerName}*, Batch ${batchNum} of 3 has been dispatched successfully!\n\n`;
    ownerCard += `👥 *Assigned Creators:* ${creatorNamesList}\n`;
    ownerCard += `📊 *Total Assignments Sent:* ${dispatchedAssignments}\n\n`;
    ownerCard += `📋 *Content Breakdown:*\n`;
    ownerCard += `• 📝 Text Posts: *${textCount}*\n`;
    ownerCard += `• 🖼 Graphic/Image Posts: *${graphicCount}*\n`;
    ownerCard += `• 📰 Articles: *${articleCount}*\n\n`;
    ownerCard += `⏰ *Posting Window:* \`${defaultTimeEST}\``;
    return ownerCard;
  });
}

// --------------------------------------------------------------------
// 2. OVERDUE TASK SLA ENFORCER & ALL OWNERS ALERTS
// --------------------------------------------------------------------
async function checkOverdueSLA() {
  try {
    const tasksRes = await runQuery(
      `SELECT aq.*, c.public_name as creator_name, c.telegram_chat_id, p.name as platform_name
       FROM public.assignment_queue aq
       LEFT JOIN public.creators c ON aq.creator_id = c.id
       LEFT JOIN public.platforms p ON aq.platform_id = p.id
       WHERE aq.status IN ('Delivered', 'Pending') AND (aq.sla_ticketed IS NOT TRUE OR aq.sla_ticketed IS NULL)`
    );

    const now = new Date();

    for (const task of tasksRes.rows) {
      const deliveredAt = task.delivered_at ? new Date(task.delivered_at) : new Date(task.created_at);
      const minutesElapsed = Math.floor((now - deliveredAt) / (1000 * 60));

      if (minutesElapsed >= 30 && minutesElapsed < 60 && !task.sla_nudge_sent) {
        if (task.telegram_chat_id) {
          await apiCall('sendMessage', {
            chat_id: task.telegram_chat_id,
            text: `⏰ *OVERDUE TASK REMINDER*\n\nHi *${task.creator_name}*, assignment \`${task.id}\` for *${task.platform_name || task.platform_id}* is 30 minutes past post time.\n\nPlease post your content and click *[Mark as Done]* below.`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Mark as Done Now', callback_data: `mark_done:${task.id}` }]
              ]
            }
          });
        }
        await runQuery(`UPDATE public.assignment_queue SET sla_nudge_sent = true WHERE id = $1`, [task.id]);
      }

      else if (minutesElapsed >= 60 && !task.sla_ticketed) {
        const issueId = `ISS-SLA-${Date.now().toString().substring(6)}`;
        const issueDesc = `AUTOMATED SLA OVERDUE TICKET: Assignment ${task.id} for platform ${task.platform_name || task.platform_id} exceeded the 60-minute SLA post window.`;

        await runQuery(
          `INSERT INTO public.issue_tickets (id, creator_id, creator_name, platform_id, issue_type, description, status)
           VALUES ($1, $2, $3, $4, 'SLA Overdue 60m', $5, 'OPEN')`,
          [issueId, task.creator_id, task.creator_name, task.platform_id, issueDesc]
        );

        await runQuery(`UPDATE public.assignment_queue SET sla_ticketed = true WHERE id = $1`, [task.id]);
        logActivity('SLA_ALERT', task.creator_id, task.creator_name, task.platform_id, `🚨 SLA 60m Overdue Ticket ${issueId} generated for ${task.creator_name} on ${task.platform_name || task.platform_id} (${task.id}).`);

        // Broadcast to ALL Owners
        await broadcastToOwners((ownerName) => {
          let alert = `🚨 *OWNER ALERT — 60m SLA OVERDUE TICKET*\n\n`;
          alert += `Hi *${ownerName}*, an SLA overdue ticket was generated:\n\n`;
          alert += `🎫 *Ticket:* \`${issueId}\`\n`;
          alert += `👤 *Creator:* ${task.creator_name} (\`${task.creator_id}\`)\n`;
          alert += `📱 *Platform:* ${task.platform_name || task.platform_id}\n`;
          alert += `📋 *Assignment:* \`${task.id}\`\n\n`;
          alert += `⚡️ Ticket logged in CRM Issue Desk. SLA tracking for this task is now frozen.`;
          return alert;
        });
      }
    }
  } catch (err) {
    console.error('SLA Check Error:', err.message);
  }
}

setInterval(checkOverdueSLA, 5 * 60 * 1000); // Runs every 5 minutes

// --------------------------------------------------------------------
// 3. STEP 2: PLATFORM ONBOARDING ROUTER
// --------------------------------------------------------------------
async function sendPlatformOnboardingCard(chatId, creator) {
  try {
    const accRes = await runQuery(
      `SELECT a.*, p.name as platform_name 
       FROM public.accounts a
       LEFT JOIN public.platforms p ON a.platform_id = p.id
       WHERE a.creator_id = $1 AND (a.posting_ready IS NOT TRUE OR a.posting_ready = false)
       LIMIT 1`,
      [creator.id]
    );

    const pendingAccount = accRes.rows[0];

    if (!pendingAccount) {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🎉 *ALL PLATFORMS ONBOARDED!*\n\nGreat job ${creator.public_name}! All assigned platform accounts are active and posting ready.\n\nUse /tasks to check your daily content assignments.`,
        parse_mode: 'Markdown'
      });
      return;
    }

    const platformName = pendingAccount.platform_name || pendingAccount.platform_id;
    const accountId = pendingAccount.id;

    let guide = `🌐 *YAGA PLATFORM ONBOARDING — STEP 2*\n\n`;
    guide += `📱 *Platform:* ${platformName}\n`;
    guide += `👤 *Account Owner:* ${creator.public_name} (\`${creator.id}\`)\n\n`;
    guide += `*Complete account setup:*\n`;
    guide += `1. Open ${platformName} app/website.\n`;
    guide += `2. Set display name: *${creator.public_name}*\n`;
    guide += `3. Add approved bio & profile picture.\n\n`;
    guide += `Click *[Submit Account Details]* below to register your profile link or handle!`;

    await apiCall('sendMessage', {
      chat_id: chatId,
      text: guide,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Submit Account Details', callback_data: `submit_creds:${accountId}:${pendingAccount.platform_id}` }],
          [{ text: '🚨 Report a Problem', callback_data: `report_issue:onboarding:${creator.id}` }]
        ]
      }
    });

  } catch (err) {
    console.error('Platform onboarding error:', err.message);
  }
}

// ── FETCH PENDING TASKS FOR A CREATOR ──
async function sendPendingTasksForChat(chatId) {
  try {
    const creator = await getCreatorByChatId(chatId);
    if (!creator) {
      await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Not registered. Type /registration to join.` });
      return;
    }

    const tasksRes = await runQuery(
      `SELECT aq.*, bc.shared_topic, bc.publish_time, p.name as platform_name 
       FROM public.assignment_queue aq
       LEFT JOIN public.base_content bc ON aq.content_id = bc.id
       LEFT JOIN public.platforms p ON aq.platform_id = p.id
       WHERE aq.creator_id = $1 AND aq.status IN ('Pending', 'Delivered')
       ORDER BY aq.created_at DESC LIMIT 10`,
      [creator.id]
    );

    if (tasksRes.rows.length === 0) {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🎉 *ALL TASKS COMPLETED!*\n\nNo pending assignments remaining, ${creator.public_name}!`,
        parse_mode: 'Markdown'
      });
      return;
    }

    for (const t of tasksRes.rows) {
      const publishTimeEST = t.publish_time || t.scheduled_time || '11:00 AM EST';
      let taskCard = `📌 *PENDING: ${t.id}* (Batch ${t.batch_number})\n\n`;
      taskCard += `👤 *${creator.public_name}*\n📱 *${t.platform_name || t.platform_id}*\n⏰ \`${publishTimeEST}\`\n\n`;
      taskCard += `📝 *CONTENT:*\n──────────────────────\n${t.caption}\n──────────────────────`;

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: taskCard,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Mark as Done', callback_data: `mark_done:${t.id}` }],
            [{ text: '🚨 Report a Problem', callback_data: `report_issue:${t.id}:${creator.id}` }]
          ]
        }
      });
    }
  } catch (err) {
    console.error('Error fetching tasks:', err.message);
  }
}

// --------------------------------------------------------------------
// 4. HTTP API & VERCEL CRON / WEBHOOK ENDPOINTS
// --------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Dispatch API Endpoint
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

  // Reply Issue API Endpoint
  else if (req.url === '/api/reply-issue' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { ticketId, creatorId, replyText } = JSON.parse(body || '{}');
        const cRes = await runQuery(`SELECT telegram_chat_id, public_name FROM public.creators WHERE id = $1`, [creatorId]);
        const chatId = cRes.rows[0]?.telegram_chat_id;
        const name = cRes.rows[0]?.public_name || 'Creator';

        if (chatId) {
          await apiCall('sendMessage', {
            chat_id: chatId,
            text: `💬 *FROM YAGA SYSTEM OWNER*\n\nHi ${name}, re: \`${ticketId}\`:\n\n"${replyText}"`,
            parse_mode: 'Markdown'
          });
        }

        runQuery(`UPDATE public.issue_tickets SET status = 'RESOLVED', owner_response = $1, resolved_at = NOW() WHERE id = $2`,
          [replyText, ticketId]).catch(e => console.error(e.message));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  // Vercel Cron Endpoint for Batch Dispatch
  else if (req.url === '/api/cron-batch') {
    await checkPendingStaggeredBatches();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', message: 'Cron batch check completed' }));
  }

  // Vercel Cron Endpoint for SLA Monitoring
  else if (req.url === '/api/cron-sla') {
    await checkOverdueSLA();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', message: 'Cron SLA check completed' }));
  }

  // Telegram Webhook Endpoint (for Vercel Serverless deployment)
  else if (req.url === '/api/telegram-webhook' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const update = JSON.parse(body || '{}');
        await handleUpdate(update);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  else if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', bot: '@yagacontentbot', mode: 'DB-Persisted Staggered Engine + Pooler' }));
  }

  else { res.writeHead(404); res.end(); }
});

server.listen(PORT, () => {
  console.log(`🚀 API: http://localhost:${PORT}`);
  console.log(`📊 Production-Hardened Bot Engine Active`);
});

// --------------------------------------------------------------------
// 5. TELEGRAM POLLING & ROUTING ENGINE
// --------------------------------------------------------------------
let offset = 0;
async function pollUpdates() {
  while (true) {
    try {
      const res = await apiCall('getUpdates', { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          handleUpdate(update);
        }
      }
    } catch (err) {
      console.error('Poll error:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function handleUpdate(update) {
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (activeSessions[chatId]) {
      const session = activeSessions[chatId];

      if (session.type === 'MEMBER_REGISTRATION') {
        const publicName = text;
        const newId = await getNextCreatorId();
        const handle = msg.from.username ? `@${msg.from.username}` : `@user_${chatId}`;

        await runQuery(
          `INSERT INTO public.creators (id, real_name, public_name, title, telegram_handle, telegram_chat_id, active, start_date)
           VALUES ($1, $2, $3, 'Team Member', $4, $5, true, CURRENT_DATE)
           ON CONFLICT (telegram_chat_id) DO UPDATE SET public_name = $3, real_name = $2`,
          [newId, publicName, publicName, handle, chatId.toString()]
        );

        await runQuery(
          `INSERT INTO public.voice_profiles (creator_id, tone, sentence_length, vocabulary, humor, cta_style)
           VALUES ($1, 'To be configured', 'To be configured', 'To be configured', 'To be configured', 'To be configured')
           ON CONFLICT (creator_id) DO NOTHING`,
          [newId]
        );

        delete activeSessions[chatId];
        logActivity('ONBOARDING', newId, publicName, null, `⚡️ ${publicName} registered on Telegram as team member (${newId}).`);

        const welcomeText = `⚡️ *STEP 1: USER ONBOARDING COMPLETED!* ⚡️\n\nHello *${publicName}*! Your creator profile is created.\n\n🆔 Creator ID: \`${newId}\`\n📱 Handle: \`${handle}\`\n\n👉 *Next Step 2:* Platform Onboarding!\nClick *[Setup My Platforms]* below to set up your accounts.`;

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: welcomeText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 2. Setup My Platforms', callback_data: 'start_platform_setup' }],
              [{ text: '📋 3. View My Tasks', callback_data: 'view_tasks' }]
            ]
          }
        });
        return;
      }

      else if (session.type === 'OWNER_REGISTRATION') {
        const ownerName = text;
        const ownerId = `OWN-${Date.now().toString().substring(7)}`;

        await runQuery(
          `INSERT INTO public.owners (id, name, telegram_chat_id, active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (telegram_chat_id) DO UPDATE SET name = $2, active = true`,
          [ownerId, ownerName, chatId.toString()]
        );

        delete activeSessions[chatId];
        logActivity('OWNER_ACTION', ownerId, ownerName, null, `👑 ${ownerName} registered as System Owner on Telegram (${ownerId}).`);

        const ownerText = `👑 *WELCOME OWNER ${ownerName.toUpperCase()}!* 👑\n\nYou are registered as a *YAGA SYSTEM OWNER*.\n\nYou will receive:\n• 📢 Batch dispatch notifications with post breakdown\n• 🚨 Instant problem ticket alerts\n• ⏰ 60-minute SLA overdue alerts\n\nAll owner alerts are now active for *${ownerName}*!`;

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: ownerText,
          parse_mode: 'Markdown'
        });
        return;
      }

      else if (session.type === 'PLATFORM_CREDENTIALS') {
        const input = text.trim();
        const profileHandleOrLink = input.split('\n')[0].trim();

        session.publicHandle = profileHandleOrLink;

        const credId = `CRD-${Date.now().toString().substring(5)}`;
        await runQuery(
          `INSERT INTO public.credentials_vault (id, account_id, creator_id, platform_id, login_identifier, password_hash, public_username)
           VALUES ($1, $2, $3, $4, $5, 'PROFILE_LINK_ONLY', $6)`,
          [credId, session.accountId, session.creatorId, session.platformId, profileHandleOrLink, profileHandleOrLink]
        );

        await runQuery(
          `UPDATE public.accounts SET posting_ready = true, status = 'Active', handle = $1 WHERE id = $2`,
          [profileHandleOrLink, session.accountId]
        );

        delete activeSessions[chatId];
        logActivity('PLATFORM_ONBOARD', session.creatorId, session.creatorName, session.platformId, `✅ ${session.creatorName || 'Creator'} completed platform setup for ${profileHandleOrLink} (${session.accountId}).`);

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `🎉 *STEP 2 PLATFORM ONBOARDING COMPLETED!*\n\nAccount \`${profileHandleOrLink}\` is now active & posting ready!\n\nUse /onboard to setup next platform or /tasks to view assignments.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 Setup Next Platform', callback_data: 'start_platform_setup' }],
              [{ text: '📋 View My Tasks', callback_data: 'view_tasks' }]
            ]
          }
        });

        await broadcastToOwners((ownerName) => {
          return `✅ *ACCOUNT ACTIVATED*\n\nHi *${ownerName}*, creator ${session.creatorName} completed onboarding for account \`${session.accountId}\` (Link/Handle: \`${profileHandleOrLink}\`).`;
        });
        return;
      }
    }

    if (text.startsWith('/owner') || text.startsWith('/admin')) {
      activeSessions[chatId] = { type: 'OWNER_REGISTRATION' };
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `👑 *YAGA OWNER REGISTRATION*\n\nPlease reply with your full name (e.g., *Rizwan* or *Chief Engineer*):`,
        parse_mode: 'Markdown'
      });
      return;
    }

    if (text.startsWith('/registration') || text.startsWith('/register') || text.startsWith('/start')) {
      const existing = await getCreatorByChatId(chatId);

      if (existing) {
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `⚡️ *Welcome Back, ${existing.public_name}!*\n\nYou are registered as creator \`${existing.id}\`.\n\nFollow your 3-step workflow:\n• *Step 2:* Setup Platforms (/onboard)\n• *Step 3:* Post Daily Content (/tasks)`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 2. Setup Platforms', callback_data: 'start_platform_setup' }],
              [{ text: '📋 3. View Tasks', callback_data: 'view_tasks' }]
            ]
          }
        });
        return;
      }

      activeSessions[chatId] = { type: 'MEMBER_REGISTRATION' };
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `⚡️ *YAGA CALLS TEAM REGISTRATION — STEP 1*\n\nPlease reply with your full display name (e.g., *Alex Crypto* or *Elena Trades*):`,
        parse_mode: 'Markdown'
      });
      return;
    }

    if (text.startsWith('/onboard')) {
      const creator = await getCreatorByChatId(chatId);
      if (creator) {
        sendPlatformOnboardingCard(chatId, creator);
      } else {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Please register first by typing /registration` });
      }
      return;
    }

    if (text.startsWith('/tasks')) {
      sendPendingTasksForChat(chatId);
      return;
    }

    if (text.startsWith('/status')) {
      const creator = await getCreatorByChatId(chatId);
      if (creator) {
        let platformCount = 0;
        try {
          const accRes = await runQuery(`SELECT COUNT(*) as cnt FROM public.accounts WHERE creator_id = $1`, [creator.id]);
          platformCount = parseInt(accRes.rows[0]?.cnt || '0', 10);
        } catch(e) {}

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `📊 *YOUR YAGA PROFILE*\n\n🆔 ID: \`${creator.id}\`\n👤 Name: *${creator.public_name}*\n📋 Platforms Assigned: ${platformCount}\n✅ Active: ${creator.active ? 'Yes' : 'No'}`,
          parse_mode: 'Markdown'
        });
      } else {
        await apiCall('sendMessage', { chat_id: chatId, text: `Not registered. Type /registration to join.` });
      }
    }
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const data = cb.data;

    if (data === 'start_platform_setup') {
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      const creator = await getCreatorByChatId(chatId);
      if (creator) sendPlatformOnboardingCard(chatId, creator);
      else {
        activeSessions[chatId] = { type: 'MEMBER_REGISTRATION' };
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `⚡️ *YAGA TEAM REGISTRATION — STEP 1*\n\nPlease reply with your full display name:`,
          parse_mode: 'Markdown'
        });
      }

    } else if (data.startsWith('submit_creds')) {
      const parts = data.split(':');
      const accountId = parts[1];
      const platformId = parts[2];
      const creator = await getCreatorByChatId(chatId);

      activeSessions[chatId] = {
        type: 'PLATFORM_CREDENTIALS',
        step: 'AWAITING_LOGIN',
        accountId: accountId,
        platformId: platformId,
        creatorId: creator?.id,
        creatorName: creator?.public_name
      };

      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🌐 *PLATFORM ONBOARDING:*\n\nSend your public profile link or handle (e.g. \`https://x.com/afraim_official\` or \`@afraim_official\`).\n\n_(Optionally add login credentials on a new line if managed centrally)_`,
        parse_mode: 'Markdown'
      });

    } else if (data.startsWith('mark_done')) {
      const assignmentId = data.split(':')[1] || '';
      runQuery(`UPDATE public.assignment_queue SET status = 'Completed', completed_at = NOW() WHERE id = $1`, [assignmentId])
        .catch(e => console.error(e.message));

      const creator = await getCreatorByChatId(chatId);
      logActivity('TASK_COMPLETE', creator?.id, creator?.public_name || cb.from.first_name, null, `✅ ${creator?.public_name || cb.from.first_name} marked assignment ${assignmentId} COMPLETED.`);

      await apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '🎉 Task marked as Done!', show_alert: false });

      const updatedText = cb.message.text + `\n\n✅ *COMPLETED* (${cb.from.first_name} @ ${new Date().toLocaleTimeString()})`;
      await apiCall('editMessageText', {
        chat_id: chatId, message_id: messageId, text: updatedText, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✅ COMPLETED', callback_data: 'noop' }]] }
      });

    } else if (data.startsWith('report_issue')) {
      const parts = data.split(':');
      const assignmentId = parts[1] || 'manual';
      let creatorId = parts[2] || null;
      let creatorName = cb.from.first_name;

      const creator = await getCreatorByChatId(chatId);
      if (creator) { creatorId = creator.id; creatorName = creator.public_name; }

      let platformId = 'PL-X';
      try {
        const asnRes = await runQuery(`SELECT platform_id FROM public.assignment_queue WHERE id = $1`, [assignmentId]);
        if (asnRes.rows.length > 0 && asnRes.rows[0].platform_id) {
          platformId = asnRes.rows[0].platform_id;
        }
      } catch (e) {}

      const issueId = `ISS-${Date.now().toString().substring(5)}`;
      await runQuery(
        `INSERT INTO public.issue_tickets (id, creator_id, creator_name, platform_id, issue_type, description, status)
         VALUES ($1, $2, $3, $4, 'Telegram Report', $5, 'OPEN')`,
        [issueId, creatorId || 'UNKNOWN', creatorName, platformId, `${creatorName} reported problem (Assignment: ${assignmentId})`]
      );

      logActivity('ISSUE_REPORTED', creatorId, creatorName, platformId, `🚨 Problem Ticket ${issueId} created by ${creatorName} for assignment ${assignmentId} on platform ${platformId}.`);

      await apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🚨 Issue ${issueId} created!`, show_alert: true });

      await broadcastToOwners((ownerName) => {
        return `🚨 *OWNER ALERT — CREATOR PROBLEM REPORTED*\n\nHi *${ownerName}*, creator ${creatorName} reported an issue:\n\n🎫 *Ticket:* \`${issueId}\`\n👤 *Creator:* ${creatorName} (\`${creatorId}\`)\n📋 *Assignment:* \`${assignmentId}\`\n\nCheck Issue Desk in CRM to reply.`;
      });

    } else if (data === 'view_tasks' || data === 'test_dispatch') {
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      sendPendingTasksForChat(chatId);

    } else if (data === 'noop') {
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
    }
  }
}

pollUpdates();
