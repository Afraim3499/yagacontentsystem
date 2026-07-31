// ====================================================================
// YAGA CALLS OPERATIONS SYSTEM — SERVERLESS CORE ENGINE MODULE
// Dual Compatible: Works with both Vercel Serverless & Local Engine
// ====================================================================

const { Pool } = require('pg');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_CONNECTION = 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

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
        delete activeSessions[chatId];
        logActivity('ONBOARDING', newId, publicName, null, `⚡️ ${publicName} registered on Telegram (${newId}).`);

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `⚡️ *USER ONBOARDED!* Hello *${publicName}* (\`${newId}\`).\n\nClick below to setup platforms:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🌐 2. Setup Platforms', callback_data: 'start_platform_setup' }]] }
        });
        return;
      }
      else if (session.type === 'OWNER_REGISTRATION') {
        const ownerName = text;
        const ownerId = `OWN-${Date.now().toString().substring(7)}`;
        await runQuery(
          `INSERT INTO public.owners (id, name, telegram_chat_id, active) VALUES ($1, $2, $3, true) ON CONFLICT (telegram_chat_id) DO UPDATE SET name = $2, active = true`,
          [ownerId, ownerName, chatId.toString()]
        );
        delete activeSessions[chatId];
        await apiCall('sendMessage', { chat_id: chatId, text: `👑 *WELCOME OWNER ${ownerName.toUpperCase()}!* All alerts are active.`, parse_mode: 'Markdown' });
        return;
      }
      else if (session.type === 'PLATFORM_CREDENTIALS') {
        const profileHandleOrLink = text.trim().split('\n')[0].trim();
        const credId = `CRD-${Date.now().toString().substring(5)}`;
        await runQuery(
          `INSERT INTO public.credentials_vault (id, account_id, creator_id, platform_id, login_identifier, password_hash, public_username) VALUES ($1, $2, $3, $4, $5, 'PROFILE_LINK_ONLY', $6)`,
          [credId, session.accountId, session.creatorId, session.platformId, profileHandleOrLink, profileHandleOrLink]
        );
        await runQuery(`UPDATE public.accounts SET posting_ready = true, status = 'Active', handle = $1 WHERE id = $2`, [profileHandleOrLink, session.accountId]);
        delete activeSessions[chatId];
        await apiCall('sendMessage', { chat_id: chatId, text: `🎉 *PLATFORM ONBOARDED!* Account \`${profileHandleOrLink}\` is active!`, parse_mode: 'Markdown' });
        await broadcastToOwners((ownerName) => `✅ *ACCOUNT ACTIVATED* Hi *${ownerName}*, creator ${session.creatorName} setup \`${profileHandleOrLink}\`.`);
        return;
      }
    }

    if (text.startsWith('/owner') || text.startsWith('/admin')) {
      activeSessions[chatId] = { type: 'OWNER_REGISTRATION' };
      await apiCall('sendMessage', { chat_id: chatId, text: `👑 *OWNER REGISTRATION:* Send your full name:`, parse_mode: 'Markdown' });
    }
    else if (text.startsWith('/registration') || text.startsWith('/register') || text.startsWith('/start')) {
      const existing = await getCreatorByChatId(chatId);
      if (existing) {
        await apiCall('sendMessage', { chat_id: chatId, text: `⚡️ Welcome back, *${existing.public_name}*!`, parse_mode: 'Markdown' });
        return;
      }
      activeSessions[chatId] = { type: 'MEMBER_REGISTRATION' };
      await apiCall('sendMessage', { chat_id: chatId, text: `⚡️ *TEAM REGISTRATION:* Send your display name:`, parse_mode: 'Markdown' });
    }
    else if (text.startsWith('/onboard')) {
      const creator = await getCreatorByChatId(chatId);
      if (creator) sendPlatformOnboardingCard(chatId, creator);
      else apiCall('sendMessage', { chat_id: chatId, text: `⚠️ Type /registration first.` });
    }
    else if (text.startsWith('/tasks')) sendPendingTasksForChat(chatId);
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
  triggerStaggered3BatchDispatch,
  checkPendingStaggeredBatches,
  checkOverdueSLA,
  replyToIssue
};
