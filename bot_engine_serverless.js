// ====================================================================
// YAGA CALLS OPERATIONS SYSTEM — SERVERLESS CORE ENGINE MODULE
// Dual Compatible: Works with both Vercel Serverless & Local Engine
// ====================================================================

try { require('dotenv').config(); } catch(e) {}
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

async function registerBotCommands() {
  try {
    await apiCall('setMyCommands', {
      commands: [
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
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    const isOwnerRes = await runQuery(`SELECT * FROM public.owners WHERE telegram_chat_id = $1 LIMIT 1`, [chatId.toString()]);
    const isOwner = isOwnerRes.rows.length > 0;

    const mainKeyboard = {
      keyboard: isOwner ? [
        [{ text: '👑 Enroll VIP Member' }, { text: '📋 My Daily Tasks' }],
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
        const monthsRaw = parts[1] ? parseInt(parts[1].trim()) : 6;
        const months = (!isNaN(monthsRaw) && monthsRaw > 0) ? monthsRaw : 6;

        let parsedDate = null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
          parsedDate = new Date(dateRaw);
        } else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateRaw)) {
          const p = dateRaw.split(/[\/\-]/);
          parsedDate = new Date(`${p[2]}-${p[1]}-${p[0]}`);
        } else {
          parsedDate = new Date(dateRaw);
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          await apiCall('sendMessage', {
            chat_id: chatId,
            text: `⚠️ *INVALID DATE FORMAT*\n\nPlease reply in format \`YYYY-MM-DD, MONTHS\`\n_(e.g., \`2025-11-15, 8\` or \`2026-01-01, 14\` or \`15/11/2025, 6\`)_:`,
            parse_mode: 'Markdown'
          });
          return;
        }

        await finalizeVipEnrollment(chatId, session.flowType, session.targetUserId, session.subVal, months, parsedDate);
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
      await runQuery(
        `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, used_invite_link, group_id, group_name, free_group_joined_at, member_tier, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'PAID_VIP_PENDING', 'PENDING_APPROVAL')
         ON CONFLICT (telegram_user_id) DO UPDATE SET group_id = EXCLUDED.group_id, group_name = EXCLUDED.group_name, member_tier = 'PAID_VIP_PENDING', status = 'PENDING_APPROVAL'`,
        [logId, user.id.toString(), user.username ? `@${user.username}` : '', user.first_name || 'Member', associateId, associateName, inviteLink || 'Direct/Unknown', groupId, groupTitle]
      );

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
      await runQuery(
        `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, used_invite_link, group_id, group_name, free_group_joined_at, member_tier, status, free_commission)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'FREE_ONLY', 'ACTIVE', $10)
         ON CONFLICT (telegram_user_id) DO UPDATE SET associate_id = EXCLUDED.associate_id, associate_name = EXCLUDED.associate_name, used_invite_link = EXCLUDED.used_invite_link, status = 'ACTIVE'`,
        [logId, user.id.toString(), user.username ? `@${user.username}` : '', user.first_name || 'Member', associateId, associateName, inviteLink || 'Direct/Unknown', groupId, groupTitle, freeComm]
      );

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

          if (existingRes.rows.length > 0) {
            await runQuery(
              `UPDATE public.community_members_log 
               SET member_tier = 'PAID_VIP', 
                   paid_group_joined_at = NOW(), 
                   status = 'ACTIVE' 
               WHERE telegram_user_id = $1`,
              [user.id.toString()]
            );
          } else {
            const logId = `MEM-${Date.now().toString().substring(5)}`;
            await runQuery(
              `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, group_id, group_name, paid_group_joined_at, member_tier, status, paid_subscription_value, paid_commission)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'PAID_VIP', 'ACTIVE', 0.00, 0.00)`,
              [logId, user.id.toString(), user.username ? `@${user.username}` : '', user.first_name || 'Member', associateId, associateName, groupId, groupTitle]
            );
          }

          console.log(`💎 PAID VIP JOIN LOGGED: ${user.first_name} (${user.id}) attributed to ${associateName}`);

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
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'FREE_ONLY', 'ACTIVE', $10)`,
              [logId, user.id.toString(), handle, firstName, associateId, associateName, inviteLink || 'Direct/Unknown', groupId, groupTitle, freeComm]
            );
            console.log(`🎉 FREE MEMBER JOIN LOGGED: ${firstName} (${user.id}) via ${associateName} (+$${freeComm.toFixed(2)})`);

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
        await runQuery(
          `UPDATE public.community_members_log SET status = 'LEFT' WHERE telegram_user_id = $1 AND group_id = $2`,
          [user.id.toString(), groupId]
        );
        console.log(`🔴 MEMBER LEFT: ${user.id} left ${groupTitle}`);
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
        activeSessions[chatId] = {
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
        activeSessions[chatId] = {
          type: 'VIP_ENROLL_CUSTOM_START_DATE',
          flowType,
          targetUserId,
          subVal
        };
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `📅 *ENTER CUSTOM ENROLLMENT START DATE & DURATION*\n\nPlease reply with the exact Start Date and Duration in format:\n\`YYYY-MM-DD, MONTHS\`\n\n*Examples:*\n• \`2025-11-15, 8\` _(Start Nov 15, 2025 for 8 Months Promo)_\n• \`2026-01-01, 14\` _(Start Jan 1, 2026 for 14 Months Promo)_\n• \`15/11/2025, 6\` _(Start Nov 15, 2025 for 6 Months)_`,
          parse_mode: 'Markdown'
        });
        return;
      }

      const months = Number(monthsArg) || 6;
      await finalizeVipEnrollment(chatId, flowType, targetUserId, subVal, months);
    }
  }
}

async function finalizeVipEnrollment(chatId, flowType, targetUserId, subVal, months, customStartDate = null) {
  const commVal = Number((subVal * 0.05).toFixed(2));
  const kabidulCommVal = Number((subVal * 0.25).toFixed(2));
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
           paid_group_joined_at = $7
       WHERE telegram_user_id = $8
       RETURNING first_name, associate_id, associate_name`,
      [subVal, commVal, kabidulCommVal, months, expDate.toISOString(), subStatus, now.toISOString(), targetUserId]
    );

    const mem = memRes.rows[0];
    memberName = mem?.first_name || 'VIP Member';
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

    await runQuery(
      `INSERT INTO public.community_members_log (id, telegram_user_id, telegram_handle, first_name, associate_id, associate_name, member_tier, paid_subscription_value, paid_commission, kabidul_commission, status, enrollment_source, enrolled_by_owner_id, paid_group_joined_at, group_name, group_id, subscription_duration_months, subscription_expiration_date, subscription_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PAID_VIP', $7, $8, $9, 'ACTIVE', 'OWNER_MANUAL_ENROLL', $10, $11, 'High Table (Paid VIP)', '-1002607815374', $12, $13, $14)`,
      [logId, userId, handle, memberName, associateId, associateName, subVal, commVal, kabidulCommVal, chatId.toString(), now.toISOString(), months, expDate.toISOString(), subStatus]
    );
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
