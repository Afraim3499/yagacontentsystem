// ====================================================================
// YAGA CALLS OPERATIONS SYSTEM — SERVERLESS CORE ENGINE MODULE
// Dual Compatible: Works with both Vercel Serverless & Local Engine
// ====================================================================

try { require('dotenv').config(); } catch(e) {}
const { Pool } = require('pg');
const { logMemberEvent, recordMemberPayment } = require('./shared/memberLog.cjs');
const { calcCommissions, resolveRatesFromDb } = require('./shared/commissions.cjs');
const { parseSignalForChart, renderSignalChartBuffer, sendPhotoBuffer } = require('./chart_card_generator');

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

const activeSessions = {};

async function logActivity(eventType, creatorId, creatorName, platformId, message) {
  try {
    const logId = `LOG-${Date.now().toString().substring(5)}`;
    await runQuery(
      `INSERT INTO public.system_logs (id, event_type, creator_id, creator_name, platform_id, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [logId, eventType, creatorId || null, creatorName || 'System', platformId || null, message]
    );
  } catch (err) {}
}

async function getAllOwners() {
  try {
    const res = await runQuery(`SELECT * FROM public.owners WHERE active = true`);
    if (res.rows.length > 0) return res.rows;
    return [{ id: 'OWN-001', name: 'System Owner', telegram_chat_id: '1617457685' }];
  } catch (e) {
    return [{ id: 'OWN-001', name: 'System Owner', telegram_chat_id: '1617457685' }];
  }
}

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
  } catch (err) {}
}

async function getCreatorByChatId(chatId) {
  try {
    const res = await runQuery(`SELECT * FROM public.creators WHERE telegram_chat_id = $1`, [chatId.toString()]);
    return res.rows[0] || null;
  } catch (e) {
    return null;
  }
}

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

async function broadcastToOwners(messageFn) {
  try {
    const res = await runQuery(`SELECT telegram_chat_id, name FROM public.owners WHERE telegram_chat_id IS NOT NULL AND active = true`);
    for (const owner of res.rows) {
      if (owner.telegram_chat_id) {
        const content = typeof messageFn === 'function' ? messageFn(owner.name || 'Owner') : messageFn;
        let payload = {};
        if (typeof content === 'object' && content !== null) {
          payload = { chat_id: owner.telegram_chat_id, parse_mode: 'Markdown', ...content };
        } else {
          payload = { chat_id: owner.telegram_chat_id, text: String(content), parse_mode: 'Markdown' };
        }
        await apiCall('sendMessage', payload);
      }
    }
  } catch (err) {
    console.error('broadcastToOwners error:', err);
  }
}

// 1000% BULLETPROOF ASSOCIATE RESOLVER
async function resolveAssociateFromLink(rawLinkObj) {
  if (!rawLinkObj) return { associateId: null, associateName: 'Unattributed / Direct', freeComm: 0.30 };

  const rawUrl = typeof rawLinkObj === 'string' ? rawLinkObj : (rawLinkObj.invite_link || '');
  const linkName = typeof rawLinkObj === 'object' ? (rawLinkObj.name || '') : '';

  let associateId = null;
  let associateName = 'Unattributed / Direct';
  let freeComm = 0.30;

  if (rawUrl) {
    const cleanUrl = rawUrl.trim();
    // Clean out protocol headers and trailing '...' from Telegram
    const hashClean = cleanUrl.replace('https://t.me/+', '').replace('https://t.me/joinchat/', '').replace('https://t.me/', '').replace('...', '').trim();
    const hashMatches = hashClean.match(/([a-zA-Z0-9_-]{5,})/);
    const linkHash = hashMatches ? hashMatches[1] : hashClean;

    // 1. Direct SQL Hash / URL Match
    let ascRes = await runQuery(
      `SELECT * FROM public.associates WHERE unique_invite_link ILIKE $1 OR unique_invite_link ILIKE $2 LIMIT 1`,
      [cleanUrl, `%${linkHash}%`]
    );

    // 2. Fallback: Match by Link Name if provided
    if (ascRes.rows.length === 0 && linkName) {
      ascRes = await runQuery(
        `SELECT * FROM public.associates WHERE name ILIKE $1 LIMIT 1`,
        [`%${linkName.trim()}%`]
      );
    }

    // 3. Fallback: In-Memory prefix scan across all associates
    if (ascRes.rows.length === 0) {
      const allAsc = await runQuery(`SELECT * FROM public.associates`);
      for (const asc of allAsc.rows) {
        if (!asc.unique_invite_link) continue;
        const ascHashClean = asc.unique_invite_link.replace('https://t.me/+', '').replace('https://t.me/joinchat/', '').replace('https://t.me/', '').replace('...', '').trim();
        const ascHashMatches = ascHashClean.match(/([a-zA-Z0-9_-]{5,})/);
        const ascHash = ascHashMatches ? ascHashMatches[1] : ascHashClean;
        if (ascHash && linkHash && (ascHash.startsWith(linkHash) || linkHash.startsWith(ascHash) || ascHash.includes(linkHash) || linkHash.includes(ascHash))) {
          associateId = asc.id;
          associateName = asc.name;
          if (Number(asc.free_commission_rate) > 0) freeComm = Number(asc.free_commission_rate);
          console.log(`🎯 BULLETPROOF IN-MEMORY PREFIX MATCH: ${rawUrl} matched to ${asc.name} (${asc.id})`);
          return { associateId, associateName, freeComm };
        }
      }
    }

    if (ascRes.rows.length > 0) {
      const asc = ascRes.rows[0];
      associateId = asc.id;
      associateName = asc.name;
      if (Number(asc.free_commission_rate) > 0) freeComm = Number(asc.free_commission_rate);
      console.log(`🎯 BULLETPROOF SQL LINK MATCH: ${rawUrl} matched to ${asc.name} (${asc.id})`);
    }
  }

  return { associateId, associateName, freeComm };
}

async function triggerStaggered3BatchDispatch(dateStr) {
  const dayId = `DAY-${dateStr.replace(/-/g, '')}`;

  await runQuery(
    `INSERT INTO public.content_days (id, date, status, total_assignments, batch_1_status, batch_2_status, batch_3_status)
     VALUES ($1, $2, 'Sent', 0, 'DISPATCHED', 'PENDING', 'PENDING')
     ON CONFLICT (id) DO UPDATE SET status = 'Sent', batch_1_status = 'DISPATCHED'`,
    [dayId, dateStr]
  );

  const contentRes = await runQuery(`SELECT * FROM public.base_content WHERE day_id = $1 ORDER BY created_at`, [dayId]);
  const allContent = contentRes.rows;
  if (allContent.length === 0) return { success: false, message: 'No content for date ' + dateStr };

  const creatorsRes = await runQuery(`SELECT * FROM public.creators WHERE telegram_chat_id IS NOT NULL AND active = true`);
  const creators = creatorsRes.rows;

  const contentIds = allContent.map(c => c.id);
  const captionsRes = await runQuery(`SELECT * FROM public.creator_captions WHERE content_id = ANY($1)`, [contentIds]);
  const captions = captionsRes.rows;

  const platformsRes = await runQuery(`SELECT * FROM public.platforms`);
  const platformMap = {};
  platformsRes.rows.forEach(p => { platformMap[p.id] = p.name; });

  const batchSize = Math.ceil(allContent.length / 3);
  const batch1 = allContent.slice(0, batchSize);

  await dispatchBatch(1, batch1, creators, captions, platformMap, dayId, '11:00 AM EST');
  return { success: true, message: 'Batch 1 dispatched via Vercel Serverless!' };
}

async function checkPendingStaggeredBatches() {
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

  if (dayRow.batch_2_status === 'PENDING' && minutesSinceCreated >= 30 && batch2.length > 0) {
    await dispatchBatch(2, batch2, creators, captions, platformMap, dayId, '11:30 AM EST');
    await runQuery(`UPDATE public.content_days SET batch_2_status = 'DISPATCHED' WHERE id = $1`, [dayId]);
  }

  if (dayRow.batch_3_status === 'PENDING' && minutesSinceCreated >= 60 && batch3.length > 0) {
    await dispatchBatch(3, batch3, creators, captions, platformMap, dayId, '12:00 PM EST');
    await runQuery(`UPDATE public.content_days SET batch_3_status = 'DISPATCHED' WHERE id = $1`, [dayId]);
  }
}

async function dispatchBatch(batchNum, contentRows, creators, allCaptions, platformMap, dayId, defaultTimeEST) {
  let textCount = 0; let graphicCount = 0; let articleCount = 0; let dispatchedAssignments = 0;
  const targetedCreatorIds = new Set();

  for (const content of contentRows) {
    const platformName = platformMap[content.platform_id] || content.platform_id;
    const publishTimeEST = content.publish_time || defaultTimeEST;
    const driveLink = content.drive_link;

    if (content.content_type === 'Article') articleCount++;
    else if (driveLink) graphicCount++;
    else textCount++;

    for (const creator of creators) {
      const captionRow = allCaptions.find(cap => cap.content_id === content.id && cap.creator_id === creator.id);
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
      card += `📝 *YOUR CONTENT TO POST:*\n──────────────────────\n${captionText}\n──────────────────────`;
      if (driveLink) card += `\n\n🔗 *Asset:* [View Graphic](${driveLink})`;

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
      ).catch(e => {});

      dispatchedAssignments++;
      targetedCreatorIds.add(creator.public_name);
    }
  }

  const creatorNamesList = Array.from(targetedCreatorIds).join(', ') || 'Active Team';
  logActivity('DISPATCH', null, 'System Dispatcher', null, `📢 Batch ${batchNum} dispatched: ${dispatchedAssignments} assignments sent to creators (${creatorNamesList}).`);

  await broadcastToOwners((ownerName) => {
    let ownerCard = `📢 *OWNER DISPATCH NOTIFICATION*\n\n`;
    ownerCard += `Hi *${ownerName}*, Batch ${batchNum} of 3 has been dispatched successfully!\n\n`;
    ownerCard += `👥 *Assigned Creators:* ${creatorNamesList}\n`;
    ownerCard += `📊 *Total Assignments Sent:* ${dispatchedAssignments}\n\n`;
    ownerCard += `📋 *Content Breakdown:*\n• 📝 Text: *${textCount}*\n• 🖼 Graphic: *${graphicCount}*\n• 📰 Article: *${articleCount}*\n\n`;
    ownerCard += `⏰ *Posting Window:* \`${defaultTimeEST}\``;
    return ownerCard;
  });
}

async function checkOverdueSLA() {
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
          reply_markup: { inline_keyboard: [[{ text: '✅ Mark as Done Now', callback_data: `mark_done:${task.id}` }]] }
        });
      }
      await runQuery(`UPDATE public.assignment_queue SET sla_nudge_sent = true WHERE id = $1`, [task.id]);
    }

    else if (minutesElapsed >= 60 && !task.sla_ticketed) {
      const issueId = `ISS-SLA-${Date.now().toString().substring(6)}`;
      const issueDesc = `AUTOMATED SLA OVERDUE TICKET: Assignment ${task.id} for platform ${task.platform_name || task.platform_id} exceeded 60m SLA.`;

      await runQuery(
        `INSERT INTO public.issue_tickets (id, creator_id, creator_name, platform_id, issue_type, description, status)
         VALUES ($1, $2, $3, $4, 'SLA Overdue 60m', $5, 'OPEN')`,
        [issueId, task.creator_id, task.creator_name, task.platform_id, issueDesc]
      );

      await runQuery(`UPDATE public.assignment_queue SET sla_ticketed = true WHERE id = $1`, [task.id]);
      logActivity('SLA_ALERT', task.creator_id, task.creator_name, task.platform_id, `🚨 SLA 60m Ticket ${issueId} generated for ${task.creator_name} (${task.id}).`);

      await broadcastToOwners((ownerName) => {
        let alert = `🚨 *OWNER ALERT — 60m SLA OVERDUE TICKET*\n\n`;
        alert += `Hi *${ownerName}*, an SLA overdue ticket was generated:\n\n`;
        alert += `🎫 *Ticket:* \`${issueId}\`\n👤 *Creator:* ${task.creator_name} (\`${task.creator_id}\`)\n📱 *Platform:* ${task.platform_name || task.platform_id}\n\n`;
        alert += `⚡️ Ticket logged in CRM Issue Desk. SLA tracking frozen.`;
        return alert;
      });
    }
  }
}

async function sendPlatformOnboardingCard(chatId, creator) {
  const accRes = await runQuery(
    `SELECT a.*, p.name as platform_name FROM public.accounts a LEFT JOIN public.platforms p ON a.platform_id = p.id WHERE a.creator_id = $1 AND (a.posting_ready IS NOT TRUE OR a.posting_ready = false) LIMIT 1`,
    [creator.id]
  );
  const pendingAccount = accRes.rows[0];

  if (!pendingAccount) {
    await apiCall('sendMessage', { chat_id: chatId, text: `🎉 *ALL PLATFORMS ONBOARDED!*\n\nGreat job ${creator.public_name}! All assigned accounts are active.`, parse_mode: 'Markdown' });
    return;
  }

  const platformName = pendingAccount.platform_name || pendingAccount.platform_id;
  let guide = `🌐 *YAGA PLATFORM ONBOARDING — STEP 2*\n\n📱 *Platform:* ${platformName}\n👤 *Owner:* ${creator.public_name} (\`${creator.id}\`)\n\nClick *[Submit Account Details]* below to register profile link or handle!`;

  await apiCall('sendMessage', {
    chat_id: chatId, text: guide, parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '🔑 Submit Account Details', callback_data: `submit_creds:${pendingAccount.id}:${pendingAccount.platform_id}` }]] }
  });
}

async function sendPendingTasksForChat(chatId) {
  const creator = await getCreatorByChatId(chatId);
  if (!creator) { await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Not registered. Type /registration to join.` }); return; }

  const tasksRes = await runQuery(
    `SELECT aq.*, bc.shared_topic, bc.publish_time, p.name as platform_name FROM public.assignment_queue aq LEFT JOIN public.base_content bc ON aq.content_id = bc.id LEFT JOIN public.platforms p ON aq.platform_id = p.id WHERE aq.creator_id = $1 AND aq.status IN ('Pending', 'Delivered') ORDER BY aq.created_at DESC LIMIT 10`,
    [creator.id]
  );

  if (tasksRes.rows.length === 0) {
    await apiCall('sendMessage', { chat_id: chatId, text: `🎉 *ALL TASKS COMPLETED!*`, parse_mode: 'Markdown' });
    return;
  }

  for (const t of tasksRes.rows) {
    let taskCard = `📌 *PENDING: ${t.id}* (Batch ${t.batch_number})\n\n👤 *${creator.public_name}*\n📱 *${t.platform_name || t.platform_id}*\n\n📝 *CONTENT:*\n──────────────────────\n${t.caption}\n──────────────────────`;
    await apiCall('sendMessage', {
      chat_id: chatId, text: taskCard, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✅ Mark as Done', callback_data: `mark_done:${t.id}` }], [{ text: '🚨 Report a Problem', callback_data: `report_issue:${t.id}:${creator.id}` }]] }
    });
  }
}

function parseSignalData(rawText) {
  let symbol = 'CRYPTO';
  let entry = 'Market';
  let tp = 'Open Target';
  let sl = 'Strict SL';
  let leverage = '1x-3x';
  let notes = '';

  const lines = (rawText || '').split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lUpper = line.toUpperCase();
    if (lUpper.includes('$') || /^[A-Z0-9]{2,10}\s*(USDT|PERP|CALL)?$/i.test(line)) {
      symbol = line.replace(/^\$/, '').trim();
    } else if (lUpper.includes('ENTRY')) {
      entry = line.replace(/^.*ENTRY\s*~?:?\s*/i, '').trim() || line;
    } else if (lUpper.includes('TP')) {
      tp = line.replace(/^.*TP\s*~?:?\s*/i, '').trim() || line;
    } else if (lUpper.includes('SL')) {
      sl = line.replace(/^.*SL\s*~?:?\s*/i, '').trim() || line;
    } else if (lUpper.includes('LEVERAGE')) {
      leverage = line.replace(/^.*LEVERAGE\s*~?:?\s*/i, '').trim() || line;
    } else {
      if (notes) notes += '\n' + line;
      else notes = line;
    }
  }

  return { symbol, entry, tp, sl, leverage, notes };
}

function buildFormattedSignalText(symbol, entry, tp, sl, leverage, notes) {
  const symClean = symbol.startsWith('$') ? symbol : `$${symbol.toUpperCase()}`;
  let card = `💰 *${symClean} TRADING SIGNAL*\n\n`;
  card += `📍 *ENTRY:* \`${entry}\`\n`;
  card += `🎯 *TP:* \`${tp}\`\n`;
  card += `🛑 *SL:* \`${sl}\`\n`;
  card += `⚡️ *LEVERAGE:* \`${leverage}\`\n`;

  if (notes) {
    card += `\n💡 *SPECIALIZED SETUP NOTES:*\n_${notes}_\n`;
  }
  return card;
}

async function registerBotCommands() {
  try {
    await apiCall('setMyCommands', {
      commands: [
        { command: 'signal', description: '📊 Post Trade Signal Setup (Owner & Associate)' },
        { command: 'closesignal', description: '🎯 Close / Update Active Trade Signal' },
        { command: 'enroll_vip', description: '👑 Enroll VIP Member (Owner Tool)' },
        { command: 'start', description: '⚡️ Open Operations Main Menu & Buttons' },
        { command: 'register', description: '✍️ Register as Team Creator' },
        { command: 'tasks', description: '📋 View My Daily Assignments' },
        { command: 'onboard', description: '🌐 Setup Target Platform Accounts' },
        { command: 'issue', description: '⚠️ Report a Platform Problem' }
      ]
    });
    console.log('✅ Telegram Bot Commands Menu Registered Successfully!');
  } catch (e) {
    console.error('Failed to register bot commands:', e);
  }
}
registerBotCommands();

async function handleUpdate(update) {
  if (update.message && (update.message.text || update.message.caption || update.message.photo)) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || msg.caption || '').trim();

    const isOwnerRes = await runQuery(`SELECT * FROM public.owners WHERE telegram_chat_id = $1 LIMIT 1`, [chatId.toString()]);
    const isOwner = isOwnerRes.rows.length > 0;

    const isAscRes = await runQuery(
      `SELECT * FROM public.associates WHERE telegram_chat_id = $1 OR name ILIKE $2 LIMIT 1`,
      [chatId.toString(), msg.from && msg.from.first_name ? `%${msg.from.first_name}%` : '___']
    );
    const isAssociate = isAscRes.rows.length > 0;
    const isAuthorizedSignalCreator = isOwner || isAssociate;

    const mainKeyboard = {
      keyboard: isAuthorizedSignalCreator ? [
        [{ text: '📊 Post Trade Signal' }, { text: '🎯 Update Signal Result' }],
        isOwner ? [{ text: '👑 Enroll VIP Member' }, { text: '📋 My Daily Tasks' }] : [{ text: '✍️ Register as Creator' }, { text: '📋 My Daily Tasks' }],
        [{ text: '🌐 Setup Platforms' }, { text: '⚠️ Report a Problem' }]
      ] : [
        [{ text: '✍️ Register as Creator' }, { text: '📋 My Daily Tasks' }],
        [{ text: '🌐 Setup Platforms' }, { text: '⚠️ Report a Problem' }]
      ],
      resize_keyboard: true,
      persistent: true
    };

    if (activeSessions[chatId]) {
      const session = activeSessions[chatId];
      if (session.type === 'MEMBER_REGISTRATION') {
        if (text.startsWith('/')) {
          await apiCall('sendMessage', { 
            chat_id: chatId, 
            text: `⚠️ *INVALID NAME:* Please reply with your actual **Display Name** (e.g. *Alex Vance* or *Crypto Analyst*), not a bot command.`, 
            parse_mode: 'Markdown' 
          });
          return;
        }

        const publicName = text;
        const newId = await getNextCreatorId();
        const handle = msg.from.username ? `@${msg.from.username}` : `@user_${chatId}`;

        await runQuery(
          `INSERT INTO public.creators (id, real_name, public_name, title, telegram_handle, telegram_chat_id, active, start_date)
           VALUES ($1, $2, $3, 'Team Member', $4, $5, true, CURRENT_DATE)
           ON CONFLICT (telegram_chat_id) DO UPDATE SET public_name = $3, real_name = $2`,
          [newId, publicName, publicName, handle, chatId.toString()]
        );

        // Auto-create pending accounts for default active platforms
        try {
          const platformsRes = await runQuery(`SELECT id, name FROM public.platforms`);
          for (const p of (platformsRes.rows || [])) {
            const accountId = `AC-${p.id.replace('PL-','')}-${newId.replace('CR-','CR')}`;
            const defaultHandle = `@${publicName.replace(/\s+/g, '_').toLowerCase()}_${p.name.split(' ')[0].toLowerCase()}`;
            await runQuery(
              `INSERT INTO public.accounts (id, creator_id, platform_id, handle, status, posting_ready)
               VALUES ($1, $2, $3, $4, 'Pending', false)
               ON CONFLICT (id) DO NOTHING`,
              [accountId, newId, p.id, defaultHandle]
            );
          }
        } catch (accErr) {
          console.error('Error auto-creating accounts:', accErr);
        }

        delete activeSessions[chatId];
        logActivity('ONBOARDING', newId, publicName, null, `⚡️ ${publicName} registered on Telegram (${newId}).`);

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `🎉 *CREATOR REGISTRATION COMPLETE!*\n\nHello *${publicName}* (\`${newId}\`)! You are registered on Yaga Calls.\n\nNext step: Click **[🌐 Setup Platforms]** below to submit your target social media handles/links.`,
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
        return;
      }
      else if (session.type === 'OWNER_REGISTRATION') {
        const ownerName = text;
        const ownerId = `OWN-${Date.now().toString().substring(7)}`;
        
        const existingOwner = await runQuery(`SELECT id FROM public.owners WHERE telegram_chat_id = $1 LIMIT 1`, [chatId.toString()]);
        if (existingOwner.rows.length > 0) {
          await runQuery(`UPDATE public.owners SET name = $1, active = true WHERE telegram_chat_id = $2`, [ownerName, chatId.toString()]);
        } else {
          await runQuery(
            `INSERT INTO public.owners (id, name, telegram_chat_id, active) VALUES ($1, $2, $3, true)`,
            [ownerId, ownerName, chatId.toString()]
          );
        }

        delete activeSessions[chatId];
        await apiCall('sendMessage', { 
          chat_id: chatId, 
          text: `👑 *WELCOME OWNER ${ownerName.toUpperCase()}!* All alerts are active.`, 
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
        return;
      }
      else if (session.type === 'VIP_ENROLL_MEMBER_NAME') {
        const memberInput = text.trim();
        const ascRes = await runQuery(`SELECT * FROM public.associates ORDER BY name ASC`);
        const associatesList = ascRes.rows;

        // Build Associate Selector Keyboard
        const inlineKeyboard = [];
        for (let i = 0; i < associatesList.length; i += 2) {
          const row = [];
          row.push({ text: `👤 ${associatesList[i].name}`, callback_data: `vip_asc:${associatesList[i].id}` });
          if (associatesList[i + 1]) {
            row.push({ text: `👤 ${associatesList[i + 1].name}`, callback_data: `vip_asc:${associatesList[i + 1].id}` });
          }
          inlineKeyboard.push(row);
        }
        inlineKeyboard.push([{ text: `🌐 Direct / Unattributed VIP`, callback_data: `vip_asc:DIRECT` }]);

        activeSessions[chatId] = {
          type: 'VIP_ENROLL_SELECT_ASC',
          memberName: memberInput
        };

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `📌 *SELECT REFERRED ASSOCIATE FOR ${memberInput}:*\n\nClick the Associate whose invite link brought this member to the Free Group:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        return;
      }
      else if (session.type === 'VIP_ENROLL_CUSTOM_DUR') {
        const inputNum = parseInt(text.trim());
        if (isNaN(inputNum) || inputNum <= 0) {
          await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Please send a valid number of months (e.g. 1, 3, 6, 12).` });
          return;
        }
        await finalizeVipEnrollment(chatId, session.flowType, session.targetUserId, session.subVal, inputNum);
        return;
      }
      else if (session.type === 'VIP_ENROLL_CUSTOM_START_DATE') {
        const parts = text.split(',');
        const dateRaw = parts[0].trim();
        const monthsRaw = parts[1] ? parseInt(parts[1].trim()) : (session.months || 8);
        const months = (!isNaN(monthsRaw) && monthsRaw > 0) ? monthsRaw : 8;

        let parsedDate = null;
        if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(dateRaw)) {
          const p = dateRaw.split(/[\/\-]/);
          parsedDate = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12, 0, 0);
        } else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateRaw)) {
          const p = dateRaw.split(/[\/\-]/);
          parsedDate = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0);
        } else {
          parsedDate = new Date(dateRaw);
          if (!isNaN(parsedDate.getTime())) {
            parsedDate.setHours(12, 0, 0, 0);
          }
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          await apiCall('sendMessage', {
            chat_id: chatId,
            text: `⚠️ *INVALID DATE FORMAT*\n\nPlease reply with the date e.g. \`2026-08-01\` or \`2026-08-01, 8\` or select a quick date button above:`,
            parse_mode: 'Markdown'
          });
          return;
        }

        await finalizeVipEnrollment(chatId, session.flowType, session.targetUserId, session.subVal, months, parsedDate);
        return;
      }
      else if (session.type === 'SIGNAL_INPUT_SETUP') {
        const photoArray = msg.photo;
        const photoFileId = photoArray && photoArray.length > 0 ? photoArray[photoArray.length - 1].file_id : null;
        const rawText = (msg.caption || msg.text || '').trim();

        if (!rawText && !photoFileId) {
          await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Please send trade signal parameters (e.g., $KGEN Entry 0.24-0.20 TP 0.35-0.70 SL 0.13 Leverage 1x-3x).` });
          return;
        }

        const parsed = parseSignalData(rawText);
        const formattedText = buildFormattedSignalText(parsed.symbol, parsed.entry, parsed.tp, parsed.sl, parsed.leverage, parsed.notes);

        let chartBuffer = null;
        if (!photoFileId) {
          const chartParams = parseSignalForChart(parsed);
          if (chartParams) {
            await apiCall('sendMessage', { chat_id: chatId, text: `⚙️ *Generating HQ Trading Signal Chart Card...*`, parse_mode: 'Markdown' });
            chartBuffer = await renderSignalChartBuffer(chartParams);
          }
        }

        activeSessions[chatId] = {
          type: 'SIGNAL_PREVIEW_CONFIRM',
          symbol: parsed.symbol,
          entry: parsed.entry,
          tp: parsed.tp,
          sl: parsed.sl,
          leverage: parsed.leverage,
          notes: parsed.notes,
          photoFileId,
          chartBuffer,
          formattedText,
          creatorId: session.creatorId,
          creatorName: session.creatorName,
          creatorType: session.creatorType
        };

        const previewKeyboard = {
          inline_keyboard: [
            [ { text: '👑 High Table VIP Only', callback_data: 'sig_target:VIP' } ],
            [ { text: '📢 Both Free & High Table VIP', callback_data: 'sig_target:BOTH' } ],
            [ { text: '✍️ Re-enter Signal', callback_data: 'sig_target:RETRY' }, { text: '❌ Cancel', callback_data: 'sig_target:CANCEL' } ]
          ]
        };

        if (photoFileId) {
          await apiCall('sendPhoto', {
            chat_id: chatId,
            photo: photoFileId,
            caption: `📋 *LIVE PREVIEW OF TRADE SIGNAL MESSAGE:*\n\n${formattedText}\n\n👇 *Select target group to broadcast:*`,
            parse_mode: 'Markdown',
            reply_markup: previewKeyboard
          });
        } else if (chartBuffer) {
          await sendPhotoBuffer(chatId, chartBuffer, `📋 *LIVE PREVIEW OF TRADE SIGNAL MESSAGE (WITH HQ CHART):*\n\n${formattedText}\n\n👇 *Select target group to broadcast:*`, { reply_markup: previewKeyboard });
        } else {
          await apiCall('sendMessage', {
            chat_id: chatId,
            text: `📋 *LIVE PREVIEW OF TRADE SIGNAL MESSAGE:*\n\n${formattedText}\n\n👇 *Select target group to broadcast:*`,
            parse_mode: 'Markdown',
            reply_markup: previewKeyboard
          });
        }
        return;
      }
      else if (session.type === 'SIGNAL_CUSTOM_PNL_INPUT') {
        const pnlInput = text.replace(/[^0-9\.\-]/g, '');
        const pnlVal = Number(pnlInput);
        if (isNaN(pnlVal)) {
          await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Invalid number. Please reply with profit/loss percentage e.g. \`145\` or \`-15\`:` });
          return;
        }

        delete activeSessions[chatId];
        await finalizeSignalResult(chatId, session.sigId, 'CUSTOM', pnlVal);
        return;
      }
      else if (session.type === 'PLATFORM_ONBOARDING') {
        const profileHandleOrLink = text.trim().split('\n')[0].trim();
        const credId = `CRD-${Date.now().toString().substring(5)}`;
        await runQuery(
          `INSERT INTO public.credentials_vault (id, account_id, creator_id, platform_id, login_identifier, password_hash, public_username) VALUES ($1, $2, $3, $4, $5, 'PROFILE_LINK_ONLY', $6)`,
          [credId, session.accountId, session.creatorId, session.platformId, profileHandleOrLink, profileHandleOrLink]
        );
        await runQuery(`UPDATE public.accounts SET posting_ready = true, status = 'Active', handle = $1 WHERE id = $2`, [profileHandleOrLink, session.accountId]);
        delete activeSessions[chatId];
        await apiCall('sendMessage', { chat_id: chatId, text: `🎉 *PLATFORM ONBOARDED!* Account \`${profileHandleOrLink}\` is active!`, parse_mode: 'Markdown', reply_markup: mainKeyboard });
        await broadcastToOwners((ownerName) => `✅ *ACCOUNT ACTIVATED* Hi *${ownerName}*, creator ${session.creatorName} setup \`${profileHandleOrLink}\`.`);
        return;
      }
    } // End of activeSessions handling

    if (text.startsWith('/owner') || text.startsWith('/admin')) {
      activeSessions[chatId] = { type: 'OWNER_REGISTRATION' };
      await apiCall('sendMessage', { 
        chat_id: chatId, 
        text: `👑 *OWNER REGISTRATION:* Send your full display name:`, 
        parse_mode: 'Markdown' 
      });
      return;
    }

    // --- 📊 TRADE SIGNAL POSTING WIZARD ---
    if (text.includes('Post Trade Signal') || text.startsWith('/signal')) {
      if (!isAuthorizedSignalCreator) {
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `⚠️ *ACCESS RESTRICTED*: Trade Signal posting is reserved for System Owners & Authorized Associates.`,
          parse_mode: 'Markdown'
        });
        return;
      }

      const creatorName = isAssociate ? isAscRes.rows[0].name : (isOwnerRes.rows[0]?.name || 'System Owner');
      const creatorId = isAssociate ? isAscRes.rows[0].id : chatId.toString();
      const creatorType = isAssociate ? 'ASSOCIATE' : 'OWNER';

      activeSessions[chatId] = {
        type: 'SIGNAL_INPUT_SETUP',
        creatorId,
        creatorName,
        creatorType
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `📊 *POST NEW TRADE SIGNAL SETUP*\n\nHello *${creatorName}*! Please send your trade setup details.\n\n*Example Format:* (or paste raw text)\n\`$KGEN\`\n\`ENTRY ~ 0.24 - 0.20\`\n\`TP ~ 0.35 - 0.70\`\n\`SL ~ 0.13\`\n\`LEVERAGE: 1x - 3x\`\n\n💡 *Optional*: You can attach a **Chart / Setup Screenshot Image** alongside your text!`,
        parse_mode: 'Markdown'
      });
      return;
    }

    // --- 🎯 UPDATE / CLOSE ACTIVE SIGNAL WORKFLOW ---
    if (text.includes('Update Signal Result') || text.startsWith('/closesignal') || text.startsWith('/closesig')) {
      if (!isAuthorizedSignalCreator) {
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `⚠️ *ACCESS RESTRICTED*: Trade Signal closing is reserved for System Owners & Authorized Associates.`,
          parse_mode: 'Markdown'
        });
        return;
      }

      const activeSigsRes = await runQuery(`SELECT * FROM public.trade_signals_log WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 10`);
      const activeSigs = activeSigsRes.rows || [];

      if (activeSigs.length === 0) {
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `🎉 *NO ACTIVE TRADE SIGNALS*\n\nAll posted trade signals are currently closed/completed!`,
          parse_mode: 'Markdown'
        });
        return;
      }

      const inlineKeyboard = activeSigs.map(s => [
        { text: `🎯 $${s.symbol} (Entry: ${s.entry_range})`, callback_data: `sig_close_select:${s.id}` }
      ]);

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🎯 *SELECT ACTIVE SIGNAL TO CLOSE / UPDATE RESULT:*\n\nTap the active signal below:`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
      return;
    }

    // --- 👑 OWNER VIP MEMBER MANUAL ENROLLMENT WORKFLOW ---
    if (text.includes('Enroll VIP') || text.startsWith('/enroll_vip') || text.startsWith('/vip')) {
      if (!isOwner) {
        const ownerId = `OWN-${Date.now().toString().substring(5)}`;
        await runQuery(
          `INSERT INTO public.owners (id, name, telegram_chat_id, role, active) VALUES ($1, $2, $3, 'SYSTEM_OWNER', true)`,
          [ownerId, msg.from.first_name || 'System Owner', chatId.toString()]
        );
      }

      activeSessions[chatId] = { type: 'VIP_ENROLL_MEMBER_NAME' };
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `👑 *OWNER VIP MEMBER ENROLLMENT*\n\nPlease reply with the Member's **Telegram Username**, **Name**, or **User ID**:\n_(e.g., \`@alexvance\` or \`Alex Vance\` or \`12345678\`)_`,
        parse_mode: 'Markdown'
      });
      return;
    }

    if (text.includes('Register as Creator') || text.startsWith('/registration') || text.startsWith('/register')) {
      const existing = await getCreatorByChatId(chatId);
      if (existing) {
        await apiCall('sendMessage', { 
          chat_id: chatId, 
          text: `⚡️ Welcome back, *${existing.public_name}*!\nYour account (\`${existing.id}\`) is active.\n\nUse the buttons below to check your daily tasks or setup target platforms:`, 
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
        return;
      }
      activeSessions[chatId] = { type: 'MEMBER_REGISTRATION' };
      await apiCall('sendMessage', { 
        chat_id: chatId, 
        text: `⚡️ *TEAM CREATOR REGISTRATION*\n\nPlease reply with your **Display Name** (e.g. *Alex Vance* or *Crypto Analyst*):`, 
        parse_mode: 'Markdown' 
      });
      return;
    }

    if (text.startsWith('/start')) {
      if (isOwner) {
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `👑 *WELCOME SYSTEM OWNER!*\n\nYou have full access to **Yaga Calls Operations Bot**.\n\nClick **[👑 Enroll VIP Member]** below or type \`/enroll_vip\` to quickly enroll any legacy VIP member into the CRM!`,
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
        return;
      }

      const existing = await getCreatorByChatId(chatId);
      if (existing) {
        await apiCall('sendMessage', { 
          chat_id: chatId, 
          text: `⚡️ Hello *${existing.public_name}*! Welcome to **Yaga Calls Operations**.\n\nSelect an action from the menu buttons below:`, 
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
      } else {
        await apiCall('sendMessage', { 
          chat_id: chatId, 
          text: `⚡️ Welcome to **Yaga Calls Operations Bot**!\n\nTo join the team and receive daily content dispatches, click **[✍️ Register as Creator]** below.`, 
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
      }
      return;
    }

    if (text.includes('Setup Platforms') || text.startsWith('/onboard')) {
      const creator = await getCreatorByChatId(chatId);
      if (creator) sendPlatformOnboardingCard(chatId, creator);
      else apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Please click ✍️ Register as Creator first.`, reply_markup: mainKeyboard });
      return;
    }

    if (text.includes('My Daily Tasks') || text.startsWith('/tasks')) {
      sendPendingTasksForChat(chatId);
      return;
    }

    if (text.includes('Report a Problem') || text.startsWith('/issue')) {
      const creator = await getCreatorByChatId(chatId);
      const issueId = `ISS-${Date.now().toString().substring(5)}`;
      await runQuery(
        `INSERT INTO public.issue_tickets (id, creator_id, creator_name, platform_id, issue_type, description, status) 
         VALUES ($1, $2, $3, 'PL-GENERAL', 'Telegram General Issue', 'Creator reported issue via bot menu', 'OPEN')`, 
        [issueId, creator?.id || 'UNKNOWN', creator?.public_name || msg.from.first_name]
      );
      await apiCall('sendMessage', { 
        chat_id: chatId, 
        text: `🚨 *ISSUE LOGGED:* Ticket \`${issueId}\` has been submitted to the CRM Issue Desk.\n\nOur system owner will inspect it shortly.`, 
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
      });
      return;
    }
  } // End of message text handling

  if (update.chat_join_request) {
    const req = update.chat_join_request;
    const user = req.from;
    const inviteLink = req.invite_link?.invite_link;
    const groupTitle = req.chat?.title || 'Telegram Group';
    const groupId = req.chat?.id?.toString() || '';

    console.log(`📩 CHAT_JOIN_REQUEST EVENT FOR ${user.first_name} (${user.id}) in ${groupTitle} (${groupId})`);

    const isHighTable = (groupId === '-1002607815374') || 
                        groupTitle.toLowerCase().includes('high table') || 
                        groupTitle.toLowerCase().includes('vip');

    if (isHighTable) {
      // 💎 HIGH TABLE (PAID VIP GROUP) WORKFLOW: DO NOT AUTO-APPROVE! Owner accepts manually.
      console.log(`👑 HIGH TABLE JOIN REQUEST RECEIVED FOR ${user.first_name} (${user.id}) - Awaiting Owner manual approval...`);

      // Look up member's existing referral history from Free Group join logs
      let associateId = null;
      let associateName = 'Unattributed / Direct';

      const existingMem = await runQuery(
        `SELECT * FROM public.community_members_log WHERE telegram_user_id = $1 LIMIT 1`,
        [user.id.toString()]
      );

      if (existingMem.rows.length > 0 && existingMem.rows[0].associate_name) {
        associateId = existingMem.rows[0].associate_id;
        associateName = existingMem.rows[0].associate_name;
        console.log(`📌 REFERRED ASSOCIATE FROM FREE GROUP: ${user.first_name} was originally referred by ${associateName}`);
      } else {
        const resolved = await resolveAssociateFromLink(req.invite_link || inviteLink);
        associateId = resolved.associateId;
        associateName = resolved.associateName;
      }

      // Log or update pending VIP join request in CRM database
      const logId = `MEM-${Date.now().toString().substring(5)}`;
      const reqRes = await runQuery(
        `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, used_invite_link, group_id, group_name, free_group_joined_at, member_tier, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'PAID_VIP_PENDING', 'PENDING_APPROVAL')
         ON CONFLICT (telegram_user_id) DO UPDATE SET first_name = EXCLUDED.first_name, telegram_handle = EXCLUDED.telegram_handle, group_id = EXCLUDED.group_id, group_name = EXCLUDED.group_name, member_tier = 'PAID_VIP_PENDING', status = 'PENDING_APPROVAL'
         RETURNING id`,
        [logId, user.id.toString(), user.username ? `@${user.username}` : '', user.first_name || 'Member', associateId, associateName, inviteLink || 'Direct/Unknown', groupId, groupTitle]
      );
      await logMemberEvent(runQuery, {
        memberId: reqRes.rows[0]?.id || logId, telegramUserId: user.id.toString(), memberName: user.first_name || 'Member',
        type: 'status_changed', actor: 'bot', source: 'BOT_JOIN_REQUEST',
        note: `Requested High Table — awaiting owner approval (assoc: ${associateName})`,
        detail: { after: { member_tier: 'PAID_VIP_PENDING', group: groupTitle } },
      });

      // Package Tier Selection Keyboard for Owner
      const packageKeyboard = {
        inline_keyboard: [
          [
            { text: '💵 $250 (Quarterly)', callback_data: `confirm_sub:${user.id}:250` },
            { text: '⭐️ $350 (Half-Yearly)', callback_data: `confirm_sub:${user.id}:350` }
          ],
          [
            { text: '🎁 $700 (Yearly)', callback_data: `confirm_sub:${user.id}:700` },
            { text: '⚡️ Custom $500', callback_data: `confirm_sub:${user.id}:500` }
          ]
        ]
      };

      // Notify Owner(s) via Telegram DM with Referral Info & Package Selector
      await broadcastToOwners((ownerName) => ({
        text: `👑 *HIGH TABLE JOIN REQUEST RECEIVED!*\n\nHi *${ownerName}*,\nMember *${user.first_name}* (${user.username ? '@' + user.username : 'ID: ' + user.id}) has sent a join request to *High Table*!\n\n📌 *Referred Associate:* *${associateName}*\n\n⚠️ *Note:* The bot will NOT auto-approve this member. Please accept the member in Telegram manually after selecting their subscription package below:\n\n👇 *Select package paid by member:*`,
        reply_markup: packageKeyboard
      }));

      return;
    } else {
      // 🆓 FREE GROUP WORKFLOW: AUTO-APPROVE INSTANTLY
      await apiCall('approveChatJoinRequest', {
        chat_id: groupId,
        user_id: user.id
      });

      const { associateId, associateName, freeComm } = await resolveAssociateFromLink(req.invite_link || inviteLink);

      const logId = `MEM-${Date.now().toString().substring(5)}`;
      const freeRes = await runQuery(
        `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, used_invite_link, group_id, group_name, free_group_joined_at, member_tier, status, free_commission)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'FREE_ONLY', 'ACTIVE', $10)
         ON CONFLICT (telegram_user_id) DO UPDATE SET associate_id = EXCLUDED.associate_id, associate_name = EXCLUDED.associate_name, used_invite_link = EXCLUDED.used_invite_link, status = 'ACTIVE'
         RETURNING id, (xmax = 0) AS was_insert`,
        [logId, user.id.toString(), user.username ? `@${user.username}` : '', user.first_name || 'Member', associateId, associateName, inviteLink || 'Direct/Unknown', groupId, groupTitle, freeComm]
      );
      await logMemberEvent(runQuery, {
        memberId: freeRes.rows[0]?.id || logId, telegramUserId: user.id.toString(), memberName: user.first_name || 'Member',
        type: freeRes.rows[0]?.was_insert ? 'joined_free' : 'rejoined', actor: 'bot', source: 'BOT_JOIN_REQUEST',
        note: `Joined free group ${groupTitle} via ${associateName}`,
        detail: { meta: { associate: associateName, invite_link: inviteLink || null, free_commission: freeComm } },
      });

      console.log(`🎉 FREE GROUP JOIN REQUEST APPROVED: ${user.first_name} -> ${associateName}`);
      return;
    }
  }

  if (update.chat_member) {
    const cm = update.chat_member;
    const oldStatus = cm.old_chat_member?.status;
    const newStatus = cm.new_chat_member?.status;
    const user = cm.new_chat_member?.user || cm.from;
    const inviteLink = cm.invite_link?.invite_link;
    const groupTitle = cm.chat?.title || 'Telegram Group';
    const groupId = cm.chat?.id?.toString() || '';

    console.log(`📩 CHAT_MEMBER EVENT FOR ${user.first_name} (${user.id}): old=${oldStatus} -> new=${newStatus}`);

    // MEMBER JOIN EVENT
    if ((oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'restricted' || !oldStatus) &&
        (newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator')) {
      
      try {
        const groupCfgRes = await runQuery(`SELECT group_type FROM public.group_config WHERE telegram_group_id = $1 LIMIT 1`, [groupId]);
        const isPaidGroup = (groupCfgRes.rows[0]?.group_type === 'PAID_GROUP') || 
                            groupTitle.toLowerCase().includes('vip') || 
                            groupTitle.toLowerCase().includes('paid');

        const existingRes = await runQuery(`SELECT * FROM public.community_members_log WHERE telegram_user_id = $1 LIMIT 1`, [user.id.toString()]);

        if (isPaidGroup) {
          // --- 💎 PAID VIP GROUP JOIN ATTRIBUTION ---
          let { associateId, associateName } = await resolveAssociateFromLink(cm.invite_link || inviteLink);

          if (existingRes.rows.length > 0) {
            const ex = existingRes.rows[0];
            associateId = associateId || ex.associate_id;
            associateName = (associateName !== 'Unattributed / Direct') ? associateName : (ex.associate_name || 'Direct VIP');
          }

          const logId = `MEM-${Date.now().toString().substring(5)}`;
          const vipRes = await runQuery(
            `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, group_id, group_name, paid_group_joined_at, member_tier, status, paid_subscription_value, paid_commission)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'PAID_VIP', 'ACTIVE', 0.00, 0.00)
             ON CONFLICT (telegram_user_id) DO UPDATE SET
               associate_id = COALESCE(public.community_members_log.associate_id, EXCLUDED.associate_id),
               associate_name = CASE WHEN public.community_members_log.associate_name IS NOT NULL AND public.community_members_log.associate_name != 'Unattributed / Direct' THEN public.community_members_log.associate_name ELSE EXCLUDED.associate_name END,
               member_tier = 'PAID_VIP',
               paid_group_joined_at = NOW(),
               status = 'ACTIVE'
             RETURNING id`,
            [logId, user.id.toString(), user.username ? `@${user.username}` : '', user.first_name || 'Member', associateId, associateName, groupId, groupTitle]
          );
          let vipJoinId = vipRes.rows[0]?.id || logId;

          console.log(`💎 PAID VIP JOIN LOGGED: ${user.first_name} (${user.id}) attributed to ${associateName}`);
          if (vipJoinId) {
            await logMemberEvent(runQuery, {
              memberId: vipJoinId, telegramUserId: user.id.toString(), memberName: user.first_name || 'Member',
              type: 'status_changed', actor: 'bot', source: 'BOT_CHAT_MEMBER',
              note: `Joined ${groupTitle} — awaiting package confirmation (assoc: ${associateName})`,
              detail: { after: { member_tier: 'PAID_VIP', group: groupTitle } },
            });
          }

          const packageKeyboard = {
            inline_keyboard: [
              [
                { text: '💵 $250 (Quarterly)', callback_data: `confirm_sub:${user.id}:250` },
                { text: '⭐️ $350 (Half-Yearly)', callback_data: `confirm_sub:${user.id}:350` }
              ],
              [
                { text: '🎁 $700 (Yearly)', callback_data: `confirm_sub:${user.id}:700` },
                { text: '⚡️ Custom $500', callback_data: `confirm_sub:${user.id}:500` }
              ]
            ]
          };

          await broadcastToOwners((ownerName) => ({
            text: `💎 *NEW VIP MEMBER JOINED! NEED PACKAGE CONFIRMATION*\n\nHi *${ownerName}*,\nMember *${user.first_name}* (${user.username ? '@' + user.username : 'ID: ' + user.id}) has joined *${groupTitle}*!\n\n📌 *Attributed Associate:* ${associateName}\n\n👇 *Select the package tier paid by this user:*`,
            reply_markup: packageKeyboard
          }));
        } else {
          // --- 🆓 FREE GROUP JOIN ATTRIBUTION ---
          const { associateId, associateName, freeComm } = await resolveAssociateFromLink(cm.invite_link || inviteLink);

          if (existingRes.rows.length === 0) {
            const logId = `MEM-${Date.now().toString().substring(5)}`;
            const handle = user.username ? `@${user.username}` : '';
            const firstName = user.first_name || 'Member';

            await runQuery(
              `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, used_invite_link, group_id, group_name, free_group_joined_at, member_tier, status, free_commission)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'FREE_ONLY', 'ACTIVE', $10)
               ON CONFLICT (telegram_user_id) DO UPDATE SET status = 'ACTIVE'`,
              [logId, user.id.toString(), handle, firstName, associateId, associateName, inviteLink || 'Direct/Unknown', groupId, groupTitle, freeComm]
            );
            console.log(`🎉 FREE MEMBER JOIN LOGGED: ${firstName} (${user.id}) via ${associateName} (+$${freeComm.toFixed(2)})`);
            await logMemberEvent(runQuery, {
              memberId: logId, telegramUserId: user.id.toString(), memberName: firstName,
              type: 'joined_free', actor: 'bot', source: 'BOT_CHAT_MEMBER',
              note: `Joined free group ${groupTitle} via ${associateName}`,
              detail: { meta: { associate: associateName, invite_link: inviteLink || null, free_commission: freeComm } },
            });

            if (associateId) {
              const ascInfo = await runQuery(`SELECT telegram_chat_id FROM public.associates WHERE id = $1`, [associateId]);
              const ascChatId = ascInfo.rows[0]?.telegram_chat_id;
              if (ascChatId) {
                await apiCall('sendMessage', {
                  chat_id: ascChatId,
                  text: `🎉 *NEW REFERRAL CONVERSION!*\n\nMember *${firstName}* (${handle || user.id}) joined *${groupTitle}* using your unique link.\n\n💰 *Free Commission Accrued:* \`+$${freeComm.toFixed(2)}\``,
                  parse_mode: 'Markdown'
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in chat_member handler:', err);
      }
    }
    // MEMBER LEAVE EVENT
    else if ((oldStatus === 'member' || oldStatus === 'administrator') && (newStatus === 'left' || newStatus === 'kicked')) {
      try {
        const leftRes = await runQuery(
          `UPDATE public.community_members_log
           SET status = 'LEFT', left_at = NOW()
           WHERE telegram_user_id = $1 AND group_id = $2
           RETURNING id, first_name, member_tier`,
          [user.id.toString(), groupId]
        );
        console.log(`🔴 MEMBER LEFT: ${user.id} left ${groupTitle}`);
        const left = leftRes.rows[0];
        if (left) {
          await logMemberEvent(runQuery, {
            memberId: left.id, telegramUserId: user.id.toString(), memberName: left.first_name,
            type: 'left', actor: 'bot', source: 'BOT_CHAT_MEMBER',
            note: `Left ${groupTitle} (${newStatus})`,
            detail: { meta: { group: groupTitle, tier: left.member_tier, transition: newStatus } },
          });
        }
      } catch (leaveErr) {
        console.error('Error logging member leave:', leaveErr);
      }
    }
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;

    if (data === 'start_platform_setup') {
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      const creator = await getCreatorByChatId(chatId);
      if (creator) sendPlatformOnboardingCard(chatId, creator);
    }
    else if (data.startsWith('submit_creds')) {
      const parts = data.split(':');
      const creator = await getCreatorByChatId(chatId);
      activeSessions[chatId] = { type: 'PLATFORM_CREDENTIALS', accountId: parts[1], platformId: parts[2], creatorId: creator?.id, creatorName: creator?.public_name };
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      await apiCall('sendMessage', { chat_id: chatId, text: `🌐 Send your profile link or handle:`, parse_mode: 'Markdown' });
    }
    else if (data.startsWith('mark_done')) {
      const asnId = data.split(':')[1];
      runQuery(`UPDATE public.assignment_queue SET status = 'Completed', completed_at = NOW() WHERE id = $1`, [asnId]);
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '🎉 Marked as Done!' });
    }
    else if (data.startsWith('report_issue')) {
      const parts = data.split(':');
      const issueId = `ISS-${Date.now().toString().substring(5)}`;
      await runQuery(`INSERT INTO public.issue_tickets (id, creator_id, creator_name, platform_id, issue_type, description, status) VALUES ($1, $2, $3, 'PL-X', 'Telegram Report', 'Reported issue', 'OPEN')`, [issueId, parts[2] || 'UNKNOWN', cb.from.first_name]);
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🚨 Issue ${issueId} reported!`, show_alert: true });
    }
    else if (data.startsWith('confirm_sub:')) {
      const parts = data.split(':');
      const targetUserId = parts[1];
      const subAmount = Number(parts[2]) || 700.00;
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      const durationKeyboard = {
        inline_keyboard: [
          [
            { text: '3 Months', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:3` },
            { text: '6 Months', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:6` }
          ],
          [
            { text: '🎁 8 Months (Promo)', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:8` },
            { text: '🎁 14 Months (Promo)', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:14` }
          ],
          [
            { text: '12 Months', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:12` },
            { text: '✍️ Custom Months', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:CUSTOM` }
          ],
          [
            { text: '📅 Custom Start Date & Months', callback_data: `vip_dur:REQ:${targetUserId}:${subAmount}:CUSTOM_DATE` }
          ]
        ]
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `⏳ *SELECT SUBSCRIPTION DURATION FOR MEMBER ($${subAmount} TIER):*\n\nClick standard duration, promotional offer (8 or 14 months), custom months, or custom start date:`,
        parse_mode: 'Markdown',
        reply_markup: durationKeyboard
      });
    }
    else if (data.startsWith('vip_asc:')) {
      const ascId = data.split(':')[1];
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      const session = activeSessions[chatId];
      const memberName = session?.memberName || 'VIP Member';

      let ascName = 'Unattributed / Direct';
      if (ascId !== 'DIRECT') {
        const ascRes = await runQuery(`SELECT name FROM public.associates WHERE id = $1 LIMIT 1`, [ascId]);
        if (ascRes.rows.length > 0) ascName = ascRes.rows[0].name;
      }

      activeSessions[chatId] = {
        type: 'VIP_ENROLL_SELECT_TIER',
        memberName: memberName,
        ascId: ascId === 'DIRECT' ? null : ascId,
        ascName: ascName
      };

      const packageKeyboard = {
        inline_keyboard: [
          [
            { text: '💵 $250 (Quarterly)', callback_data: 'vip_tier:250' },
            { text: '⭐️ $350 (Half-Yearly)', callback_data: 'vip_tier:350' }
          ],
          [
            { text: '🎁 $700 (Yearly)', callback_data: 'vip_tier:700' },
            { text: '⚡️ Custom $500', callback_data: 'vip_tier:500' }
          ]
        ]
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `💎 *SELECT SUBSCRIPTION PACKAGE TIER FOR ${memberName}:*\n\n📌 *Attributed Associate:* **${ascName}**\n\nClick the package tier paid by this member:`,
        parse_mode: 'Markdown',
        reply_markup: packageKeyboard
      });
    }
    else if (data.startsWith('vip_tier:')) {
      const subVal = Number(data.split(':')[1]) || 700;
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      const session = activeSessions[chatId];
      if (!session || !session.memberName) {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ VIP enrollment session expired. Please type /enroll_vip to try again.` });
        return;
      }

      session.subVal = subVal;

      const durationKeyboard = {
        inline_keyboard: [
          [
            { text: '3 Months', callback_data: `vip_dur:MANUAL:0:${subVal}:3` },
            { text: '6 Months', callback_data: `vip_dur:MANUAL:0:${subVal}:6` }
          ],
          [
            { text: '🎁 8 Months (Promo)', callback_data: `vip_dur:MANUAL:0:${subVal}:8` },
            { text: '🎁 14 Months (Promo)', callback_data: `vip_dur:MANUAL:0:${subVal}:14` }
          ],
          [
            { text: '12 Months', callback_data: `vip_dur:MANUAL:0:${subVal}:12` },
            { text: '✍️ Custom Months', callback_data: `vip_dur:MANUAL:0:${subVal}:CUSTOM` }
          ],
          [
            { text: '📅 Custom Start Date & Months', callback_data: `vip_dur:MANUAL:0:${subVal}:CUSTOM_DATE` }
          ]
        ]
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `⏳ *SELECT SUBSCRIPTION DURATION FOR ${session.memberName} ($${subVal} TIER):*\n\nClick standard duration, promotional offer (8 or 14 months), custom months, or custom start date:`,
        parse_mode: 'Markdown',
        reply_markup: durationKeyboard
      });
    }
    else if (data.startsWith('vip_dur:')) {
      const parts = data.split(':'); // vip_dur:REQ/MANUAL:targetUserId:subVal:months
      const flowType = parts[1];
      const targetUserId = parts[2];
      const subVal = Number(parts[3]) || 700;
      const monthsArg = parts[4];
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      if (monthsArg === 'CUSTOM') {
        const existingSession = activeSessions[chatId] || {};
        activeSessions[chatId] = {
          ...existingSession,
          type: 'VIP_ENROLL_CUSTOM_DUR',
          flowType,
          targetUserId,
          subVal
        };
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `✍️ *ENTER CUSTOM DURATION IN MONTHS*\n\nPlease reply with the exact number of months (e.g., \`1\`, \`2\`, \`5\`, \`18\`):`,
          parse_mode: 'Markdown'
        });
        return;
      }
      else if (monthsArg === 'CUSTOM_DATE') {
        const existingSession = activeSessions[chatId] || {};
        activeSessions[chatId] = {
          ...existingSession,
          type: 'VIP_ENROLL_CUSTOM_START_DATE',
          flowType,
          targetUserId,
          subVal
        };

        const today = new Date();
        const m1 = new Date(); m1.setMonth(m1.getMonth() - 1);
        const m2 = new Date(); m2.setMonth(m2.getMonth() - 2);
        const m3 = new Date(); m3.setMonth(m3.getMonth() - 3);
        const m6 = new Date(); m6.setMonth(m6.getMonth() - 6);

        const dateOpts = { month: 'short', day: 'numeric' };

        const quickDateKeyboard = {
          inline_keyboard: [
            [
              { text: `📍 Today (${today.toLocaleDateString('en-US', dateOpts)})`, callback_data: `vip_date:0` },
              { text: `⏪ 1 Mo Ago (${m1.toLocaleDateString('en-US', dateOpts)})`, callback_data: `vip_date:1` }
            ],
            [
              { text: `⏪ 2 Mos Ago (${m2.toLocaleDateString('en-US', dateOpts)})`, callback_data: `vip_date:2` },
              { text: `⏪ 3 Mos Ago (${m3.toLocaleDateString('en-US', dateOpts)})`, callback_data: `vip_date:3` }
            ],
            [
              { text: `⏪ 6 Mos Ago (${m6.toLocaleDateString('en-US', dateOpts)})`, callback_data: `vip_date:6` }
            ]
          ]
        };

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `📅 *SELECT OR TYPE CUSTOM ENROLLMENT START DATE*\n\nTap a quick start date button below, OR reply with your date e.g. \`2026-08-01\` or \`2026-08-01, 8\`:`,
          parse_mode: 'Markdown',
          reply_markup: quickDateKeyboard
        });
        return;
      }

      const months = Number(monthsArg) || 6;
      await finalizeVipEnrollment(chatId, flowType, targetUserId, subVal, months);
    }
    else if (data.startsWith('vip_date:')) {
      const monthsBack = Number(data.split(':')[1]) || 0;
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      const session = activeSessions[chatId];
      if (!session) {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ VIP enrollment session expired. Please type /enroll_vip to try again.` });
        return;
      }

      const customDate = new Date();
      if (monthsBack > 0) {
        customDate.setMonth(customDate.getMonth() - monthsBack);
      }

      const months = session.months || 8;
      await finalizeVipEnrollment(chatId, session.flowType, session.targetUserId, session.subVal, months, customDate);
    }
    else if (data.startsWith('sig_target:')) {
      const action = data.split(':')[1];
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      const session = activeSessions[chatId];
      if (!session) {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Session expired. Please type /signal to try again.` });
        return;
      }

      if (action === 'CANCEL') {
        delete activeSessions[chatId];
        await apiCall('sendMessage', { chat_id: chatId, text: `❌ Signal posting cancelled.` });
        return;
      } else if (action === 'RETRY') {
        activeSessions[chatId] = { ...session, type: 'SIGNAL_INPUT_SETUP' };
        await apiCall('sendMessage', { chat_id: chatId, text: `✍️ Please re-send your trade signal text or chart photo:` });
        return;
      }

      const targetAudience = action === 'VIP' ? 'HIGH_TABLE_VIP_ONLY' : 'FREE_AND_VIP';
      const targetLabel = action === 'VIP' ? '👑 High Table VIP Only' : '📢 Both Free & High Table VIP Groups';

      activeSessions[chatId] = {
        ...session,
        type: 'SIGNAL_DOUBLE_CONFIRM',
        targetAudience,
        targetLabel
      };

      const confirmKeyboard = {
        inline_keyboard: [
          [ { text: '✅ Confirm & Send Broadcast Live', callback_data: 'sig_send:CONFIRM' } ],
          [ { text: '🔙 Back to Selection', callback_data: 'sig_send:BACK' } ]
        ]
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🔒 *DOUBLE-CONFIRMATION CHECK*\n\nTarget Broadcast Channel: *${targetLabel}*\nSymbol: *$${session.symbol.toUpperCase()}*\n\nAre you sure you want to broadcast this trade signal live to the channel(s)?`,
        parse_mode: 'Markdown',
        reply_markup: confirmKeyboard
      });
      return;
    }
    else if (data.startsWith('sig_send:')) {
      const action = data.split(':')[1];
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });
      const session = activeSessions[chatId];
      if (!session) {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Session expired.` });
        return;
      }

      if (action === 'BACK') {
        activeSessions[chatId] = { ...session, type: 'SIGNAL_PREVIEW_CONFIRM' };
        await apiCall('sendMessage', { chat_id: chatId, text: `↩️ Back to target selection. Please select group:` });
        return;
      } else if (action === 'CONFIRM') {
        const sigId = `SIG-${Date.now().toString().substring(5)}`;
        const formattedText = session.formattedText;
        let vipMsgId = null;
        let freeMsgId = null;

        // Broadcast to High Table VIP (-1002607815374)
        if (session.photoFileId) {
          const resVip = await apiCall('sendPhoto', {
            chat_id: '-1002607815374',
            photo: session.photoFileId,
            caption: formattedText,
            parse_mode: 'Markdown'
          });
          if (resVip.ok && resVip.result) vipMsgId = resVip.result.message_id;
        } else if (session.chartBuffer) {
          const resVip = await sendPhotoBuffer('-1002607815374', session.chartBuffer, formattedText);
          if (resVip.ok && resVip.result) vipMsgId = resVip.result.message_id;
        } else {
          const resVip = await apiCall('sendMessage', {
            chat_id: '-1002607815374',
            text: formattedText,
            parse_mode: 'Markdown'
          });
          if (resVip.ok && resVip.result) vipMsgId = resVip.result.message_id;
        }

        // Broadcast to Free Group (-1002628054504) if target is BOTH
        if (session.targetAudience === 'FREE_AND_VIP') {
          if (session.photoFileId) {
            const resFree = await apiCall('sendPhoto', {
              chat_id: '-1002628054504',
              photo: session.photoFileId,
              caption: formattedText,
              parse_mode: 'Markdown'
            });
            if (resFree.ok && resFree.result) freeMsgId = resFree.result.message_id;
          } else if (session.chartBuffer) {
            const resFree = await sendPhotoBuffer('-1002628054504', session.chartBuffer, formattedText);
            if (resFree.ok && resFree.result) freeMsgId = resFree.result.message_id;
          } else {
            const resFree = await apiCall('sendMessage', {
              chat_id: '-1002628054504',
              text: formattedText,
              parse_mode: 'Markdown'
            });
            if (resFree.ok && resFree.result) freeMsgId = resFree.result.message_id;
          }
        }

        // Write to Supabase PostgreSQL database
        await runQuery(`
          INSERT INTO public.trade_signals_log (
            id, symbol, creator_type, creator_id, creator_name, target_audience,
            entry_range, take_profit_targets, stop_loss, leverage, custom_notes,
            chart_image_url, status, vip_group_message_id, free_group_message_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', $13, $14, NOW())
        `, [
          sigId,
          session.symbol.toUpperCase(),
          session.creatorType || 'OWNER',
          session.creatorId || chatId.toString(),
          session.creatorName || 'System Owner',
          session.targetAudience,
          session.entry || 'Market',
          session.tp || 'Open Target',
          session.sl || 'Strict SL',
          session.leverage || '1x-3x',
          session.notes || '',
          session.photoFileId || null,
          vipMsgId,
          freeMsgId
        ]);

        delete activeSessions[chatId];

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `🚀 *TRADE SIGNAL BROADCASTED LIVE & LOGGED TO CRM!*\n\nSignal ID: \`${sigId}\`\nTarget: *${session.targetLabel}*\n\nYou can track and update trade results anytime via /closesignal or the CRM Signals Desk!`,
          parse_mode: 'Markdown'
        });
        return;
      }
    }
    else if (data.startsWith('sig_close_select:')) {
      const sigId = data.split(':')[1];
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      const res = await runQuery(`SELECT * FROM public.trade_signals_log WHERE id = $1 LIMIT 1`, [sigId]);
      const sig = res.rows[0];
      if (!sig) {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Trade signal not found.` });
        return;
      }

      const resultKeyboard = {
        inline_keyboard: [
          [
            { text: '🔥 TP1 Hit (+45%)', callback_data: `sig_resolve:${sigId}:TP1:45` },
            { text: '🚀 TP2 Smashed (+120%)', callback_data: `sig_resolve:${sigId}:TP2:120` }
          ],
          [
            { text: '🌕 TP Final Hit (+250%)', callback_data: `sig_resolve:${sigId}:TPF:250` },
            { text: '🛑 SL Hit (-15%)', callback_data: `sig_resolve:${sigId}:SL:-15` }
          ],
          [
            { text: '✍️ Custom PnL % Input', callback_data: `sig_resolve_custom:${sigId}` }
          ]
        ]
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🎯 *UPDATE RESULT FOR SIGNAL $${sig.symbol}* (\`${sig.id}\`)\n\nSelect the trade result to broadcast to the group(s):`,
        parse_mode: 'Markdown',
        reply_markup: resultKeyboard
      });
      return;
    }
    else if (data.startsWith('sig_resolve_custom:')) {
      const sigId = data.split(':')[1];
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      activeSessions[chatId] = {
        type: 'SIGNAL_CUSTOM_PNL_INPUT',
        sigId
      };

      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `✍️ *ENTER CUSTOM PNL PERCENTAGE*\n\nPlease reply with the profit or loss percentage (e.g., \`145\` for +145% or \`-15\` for -15%):`,
        parse_mode: 'Markdown'
      });
      return;
    }
    else if (data.startsWith('sig_resolve:')) {
      const parts = data.split(':');
      const sigId = parts[1];
      const type = parts[2];
      const pnlVal = Number(parts[3]) || 0;
      await apiCall('answerCallbackQuery', { callback_query_id: cb.id });

      await finalizeSignalResult(chatId, sigId, type, pnlVal);
      return;
    }
  }
}

async function finalizeSignalResult(chatId, sigId, type, pnlVal) {
  const res = await runQuery(`SELECT * FROM public.trade_signals_log WHERE id = $1 LIMIT 1`, [sigId]);
  const sig = res.rows[0];
  if (!sig) return;

  let label = 'COMPLETED';
  let badge = '🔥 TP Hit!';
  if (type === 'TP1') { label = 'TP1_HIT'; badge = '🔥 TP1 HIT'; }
  else if (type === 'TP2') { label = 'TP2_HIT'; badge = '🚀 TP2 SMASHED!'; }
  else if (type === 'TPF') { label = 'TP_FINAL_HIT'; badge = '🌕 FINAL TP SMASHED!'; }
  else if (type === 'SL') { label = 'SL_HIT'; badge = '🛑 STOP LOSS HIT'; }

  const pnlFormatted = pnlVal > 0 ? `+${pnlVal.toFixed(2)}%` : `${pnlVal.toFixed(2)}%`;
  const summaryText = `${badge} (${pnlFormatted})`;

  await runQuery(`
    UPDATE public.trade_signals_log
    SET status = $1, pnl_percentage = $2, pnl_summary_text = $3, closed_at = NOW()
    WHERE id = $4
  `, [label, pnlVal, summaryText, sigId]);

  const resultText = `🎯 *TRADE CALL RESULT ANNOUNCEMENT — $${sig.symbol}*\n\nStatus: *${badge}*\nProfit / PnL: *${pnlFormatted}* ${pnlVal > 0 ? '🚀' : '🛑'}\n\nCongratulations to everyone who took this trade setup!`;

  // Dispatch reply to High Table VIP
  if (sig.vip_group_message_id) {
    await apiCall('sendMessage', {
      chat_id: '-1002607815374',
      text: resultText,
      reply_to_message_id: Number(sig.vip_group_message_id),
      parse_mode: 'Markdown'
    });
  }

  // Dispatch reply to Free Group if applicable
  if (sig.target_audience === 'FREE_AND_VIP' && sig.free_group_message_id) {
    await apiCall('sendMessage', {
      chat_id: '-1002628054504',
      text: resultText,
      reply_to_message_id: Number(sig.free_group_message_id),
      parse_mode: 'Markdown'
    });
  }

  await apiCall('sendMessage', {
    chat_id: chatId,
    text: `🎉 *SIGNAL RESULT PUBLISHED & SYNCED TO CRM!*\n\nSymbol: *$${sig.symbol}*\nResult: *${summaryText}*\nBroadcasted live to channel(s).`,
    parse_mode: 'Markdown'
  });
}

async function finalizeVipEnrollment(chatId, flowType, targetUserId, subVal, months, customStartDate = null) {
  // Pull the member's current state up front (REQ path) so we can resolve
  // commission rates and tell a first enrollment from a renewal.
  let existing = null;
  if (flowType === 'REQ') {
    try {
      const pre = await runQuery(
        `SELECT id, associate_id, first_converted_at, subscription_expiration_date,
                renewal_count, lifetime_value
         FROM public.community_members_log WHERE telegram_user_id = $1`,
        [targetUserId]
      );
      existing = pre.rows[0] || null;
    } catch (e) { /* fall back to default rates */ }
  }
  const preAssociateId = flowType === 'REQ' ? (existing?.associate_id || null) : (activeSessions[chatId]?.ascId || null);
  const rates = await resolveRatesFromDb(runQuery, preAssociateId);
  const { associate_commission: commVal, kabidul_commission: kabidulCommVal, snapshot: commSnapshot } =
    calcCommissions(subVal, rates);
  const isRenewal = flowType === 'REQ' && existing && existing.first_converted_at != null;
  const now = customStartDate ? new Date(customStartDate) : new Date();
  const expDate = new Date(now);
  expDate.setMonth(expDate.getMonth() + Number(months));

  const realNow = new Date();
  let subStatus = 'ACTIVE';
  if (expDate <= realNow) subStatus = 'EXPIRED';
  else if (expDate.getTime() - realNow.getTime() <= 7 * 24 * 60 * 60 * 1000) subStatus = 'EXPIRING_SOON';

  const isPromo = months === 8 || months === 14;
  const promoLabel = isPromo ? ' (Promo Offer)' : '';

  const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const joinedStr = now.toLocaleDateString('en-US', dateOpts);
  const expStr = expDate.toLocaleDateString('en-US', dateOpts);
  const statusBadge = subStatus === 'EXPIRED' ? '🔴 EXPIRED' : subStatus === 'EXPIRING_SOON' ? '⚠️ EXPIRING SOON' : '🟢 ACTIVE';

  let memberName = 'VIP Member';
  let associateId = null;
  let associateName = 'Unattributed / Direct';
  let memberId = null;
  const priorExpiry = existing?.subscription_expiration_date || null;
  const paymentType = isRenewal ? 'renewal' : 'new';

  if (flowType === 'REQ') {
    const memRes = await runQuery(
      `UPDATE public.community_members_log
       SET paid_subscription_value = $1,
           paid_commission = $2,
           kabidul_commission = $3,
           member_tier = 'PAID_VIP',
           status = 'ACTIVE',
           subscription_duration_months = $4,
           subscription_expiration_date = $5,
           subscription_status = $6,
           paid_group_joined_at = $7,
           first_converted_at = COALESCE(first_converted_at, $7),
           last_renewed_at = CASE WHEN $9 THEN $7 ELSE last_renewed_at END,
           renewal_count = renewal_count + CASE WHEN $9 THEN 1 ELSE 0 END,
           lifetime_value = COALESCE(lifetime_value, 0) + $1
       WHERE telegram_user_id = $8
       RETURNING id, first_name, telegram_handle, associate_id, associate_name`,
      [subVal, commVal, kabidulCommVal, months, expDate.toISOString(), subStatus, now.toISOString(), targetUserId, isRenewal]
    );

    const mem = memRes.rows[0];
    memberId = mem?.id || null;
    const nameStr = mem?.first_name && mem.first_name !== 'VIP Member' && mem.first_name !== 'Member' ? mem.first_name : '';
    const handleStr = mem?.telegram_handle ? mem.telegram_handle : '';
    if (nameStr && handleStr && !nameStr.includes(handleStr)) {
      memberName = `${nameStr} (${handleStr})`;
    } else if (handleStr) {
      memberName = handleStr;
    } else if (nameStr) {
      memberName = nameStr;
    } else {
      memberName = `Member ID: ${targetUserId}`;
    }

    associateId = mem?.associate_id;
    associateName = mem?.associate_name || 'Direct VIP';
  } else {
    const session = activeSessions[chatId];
    memberName = session?.memberName || 'VIP Member';
    associateId = session?.ascId || null;
    associateName = session?.ascName || 'Unattributed / Direct';

    const userId = targetUserId && targetUserId !== '0' ? targetUserId : `USR-${Date.now().toString().substring(6)}`;
    const logId = `MEM-${Date.now().toString().substring(5)}`;
    const handle = memberName.startsWith('@') ? memberName : '';
    memberId = logId;

    await runQuery(
      `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, member_tier, paid_subscription_value, paid_commission, kabidul_commission, status, enrollment_source, enrolled_by_owner_id, paid_group_joined_at, group_name, group_id, subscription_duration_months, subscription_expiration_date, subscription_status, first_converted_at, lifetime_value, renewal_count)
       VALUES ($1, $2, $3, $4, $5, $6, 'PAID_VIP', $7, $8, $9, 'ACTIVE', 'OWNER_MANUAL_ENROLL', $10, $11, 'High Table (Paid VIP)', '-1002607815374', $12, $13, $14, $11, $7, 0)`,
      [logId, userId, handle, memberName, associateId, associateName, subVal, commVal, kabidulCommVal, chatId.toString(), now.toISOString(), months, expDate.toISOString(), subStatus]
    );
  }

  // Append the payment + lifecycle event to the intelligence tables (non-blocking).
  if (memberId) {
    const paymentId = await recordMemberPayment(runQuery, {
      memberId,
      telegramUserId: String(targetUserId || ''),
      memberName,
      paymentType,
      amount: subVal,
      durationMonths: Number(months),
      termStart: now.toISOString(),
      termEnd: expDate.toISOString(),
      previousTermEnd: priorExpiry,
      associateId,
      associateName,
      associateCommission: commVal,
      kabidulCommission: kabidulCommVal,
      commissionSnapshot: commSnapshot,
      recordedBy: `owner:${chatId}`,
      source: flowType === 'REQ' ? 'BOT_CALLBACK' : 'BOT_MANUAL_ENROLL',
    });
    await logMemberEvent(runQuery, {
      memberId,
      telegramUserId: String(targetUserId || ''),
      memberName,
      type: isRenewal ? 'renewed' : 'enrolled',
      actor: `owner:${chatId}`,
      source: flowType === 'REQ' ? 'BOT_CALLBACK' : 'BOT_MANUAL_ENROLL',
      paymentId,
      note: `${isRenewal ? 'Renewed' : 'Enrolled'} via Telegram at $${subVal} for ${months} months`,
      detail: { after: { paid_subscription_value: subVal, months, subscription_expiration_date: expDate.toISOString(), associate: associateName } },
    });
  }

  delete activeSessions[chatId];

  await apiCall('sendMessage', {
    chat_id: chatId,
    text: `✅ *VIP MEMBER ENROLLED SUCCESSFULLY!*\n\n👤 *Member:* **${memberName}**\n📌 *Attributed Associate:* **${associateName}**\n💎 *Subscription Package:* **$${subVal} Tier**\n⏳ *Duration:* **${months} Months${promoLabel}**\n📅 *Enrollment Date:* **${joinedStr}**\n⏰ *Expiration Date:* **${expStr}**\n${statusBadge} *Status:* **${subStatus}**\n🤝 *5% Associate Commission:* **$${commVal.toFixed(2)}**\n💼 *Kabidul's 25% Commission:* **$${kabidulCommVal.toFixed(2)}**\n\n⚡️ *Synced live to database and CRM VIP Members Desk!*`,
    parse_mode: 'Markdown'
  });

  if (associateId) {
    const ascInfo = await runQuery(`SELECT telegram_chat_id, name FROM public.associates WHERE id = $1`, [associateId]);
    const ascChatId = ascInfo.rows[0]?.telegram_chat_id;
    const realAscName = ascInfo.rows[0]?.name || associateName;
    if (ascChatId) {
      await apiCall('sendMessage', {
        chat_id: ascChatId,
        text: `🎉 *CONFIRMED VIP COMMISSION BONUS!*\n\nHi *${realAscName}*,\nMember *${memberName}* (invited by your referral) was confirmed for a \`$${subVal.toFixed(2)}\` VIP Subscription (${months} Months)!\n\n💰 *Earned 5% Commission Bonus:* \`+$${commVal.toFixed(2)}\``,
        parse_mode: 'Markdown'
      });
    }
  }
}

async function replyToIssue(ticketId, creatorId, replyText) {
  const cRes = await runQuery(`SELECT telegram_chat_id, public_name FROM public.creators WHERE id = $1`, [creatorId]);
  const chatId = cRes.rows[0]?.telegram_chat_id;
  const name = cRes.rows[0]?.public_name || 'Creator';
  if (chatId) {
    await apiCall('sendMessage', { chat_id: chatId, text: `💬 *FROM OWNER*\n\nHi ${name}, re: \`${ticketId}\`:\n\n"${replyText}"`, parse_mode: 'Markdown' });
  }
  await runQuery(`UPDATE public.issue_tickets SET status = 'RESOLVED', owner_response = $1, resolved_at = NOW() WHERE id = $2`, [replyText, ticketId]);
  return { success: true };
}

module.exports = {
  handleUpdate,
  broadcastToOwners,
  triggerStaggered3BatchDispatch,
  checkPendingStaggeredBatches,
  checkOverdueSLA,
  replyToIssue
};
