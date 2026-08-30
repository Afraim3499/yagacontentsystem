// ====================================================================
// SCHEMA INTROSPECTION (read-only) — Phase 0 of the CRM member-
// intelligence overhaul.
//
// The core CRM tables (community_members_log, associates, vip_packages,
// commission_rules, payout_logs, trade_signals_log, reviews, group_config)
// and the views all_partners_view / affiliate_leaderboard_view have NO
// CREATE TABLE / CREATE VIEW anywhere in version control — they live only
// in the Supabase database. This script reconstructs their DDL by reading
// the catalog, so the repo finally has a schema of record to diff future
// migrations against.
//
// It executes SELECT statements ONLY. It never writes. Safe to run
// against production.
//
// Output (written next to this file):
//   crm_schema.sql   — reconstructed, human-readable DDL
//   crm_schema.json  — structured dump, for diffing between runs
//
// Run: DATABASE_URL="postgresql://..." node introspect_schema.js
//
// Like add_performance_indexes_v9.js, this deliberately does NOT hardcode
// a connection string. It refuses to run without DATABASE_URL.
// ====================================================================

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONNECTION = process.env.DATABASE_URL;

if (!DB_CONNECTION) {
  console.error('DATABASE_URL is not set. Refusing to run without an explicit connection string.');
  console.error('Usage: DATABASE_URL="postgresql://..." node introspect_schema.js');
  process.exit(1);
}

// Assert a read/write guard is pointless here (we only SELECT), but assert
// we are NOT going through the transaction pooler is unnecessary too —
// introspection works fine on :6543. No connection-mode assertion needed.

const SCHEMA = 'public';

async function q(client, text, params = []) {
  const res = await client.query(text, params);
  return res.rows;
}

// ── individual catalog queries ──────────────────────────────────────

async function getTables(client) {
  return q(client, `
    SELECT c.relname AS name,
           obj_description(c.oid) AS comment,
           c.relkind AS kind            -- 'r' table, 'p' partitioned, 'm' matview
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r','p','m')
    ORDER BY c.relname;
  `, [SCHEMA]);
}

async function getColumns(client) {
  return q(client, `
    SELECT table_name, column_name, ordinal_position,
           data_type, udt_name, character_maximum_length,
           numeric_precision, numeric_scale,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = $1
    ORDER BY table_name, ordinal_position;
  `, [SCHEMA]);
}

async function getConstraints(client) {
  // primary keys, unique, foreign keys, check — with the columns involved
  return q(client, `
    SELECT tc.constraint_name, tc.table_name, tc.constraint_type,
           kcu.column_name, kcu.ordinal_position,
           ccu.table_name  AS foreign_table,
           ccu.column_name AS foreign_column,
           rc.update_rule, rc.delete_rule,
           cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      AND tc.constraint_type = 'FOREIGN KEY'
    LEFT JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    LEFT JOIN information_schema.check_constraints cc
      ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = $1
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
  `, [SCHEMA]);
}

async function getIndexes(client) {
  return q(client, `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = $1
    ORDER BY tablename, indexname;
  `, [SCHEMA]);
}

async function getViews(client) {
  return q(client, `
    SELECT c.relname AS name,
           pg_get_viewdef(c.oid, true) AS definition,
           c.relkind AS kind            -- 'v' view, 'm' matview
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('v','m')
    ORDER BY c.relname;
  `, [SCHEMA]);
}

async function getFunctions(client) {
  return q(client, `
    SELECT p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_functiondef(p.oid) AS definition,
           p.prosecdef AS security_definer,
           l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = $1
    ORDER BY p.proname;
  `, [SCHEMA]);
}

async function getTriggers(client) {
  return q(client, `
    SELECT event_object_table AS table_name,
           trigger_name,
           pg_get_triggerdef(t.oid) AS definition
    FROM information_schema.triggers ist
    JOIN pg_trigger t ON t.tgname = ist.trigger_name AND NOT t.tgisinternal
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = ist.trigger_schema
    WHERE ist.trigger_schema = $1
    GROUP BY event_object_table, trigger_name, t.oid
    ORDER BY event_object_table, trigger_name;
  `, [SCHEMA]);
}

async function getPolicies(client) {
  return q(client, `
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = $1
    ORDER BY tablename, policyname;
  `, [SCHEMA]);
}

async function getRlsEnabled(client) {
  return q(client, `
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind = 'r'
    ORDER BY c.relname;
  `, [SCHEMA]);
}

async function getRealtimePublication(client) {
  return q(client, `
    SELECT pt.tablename
    FROM pg_publication p
    JOIN pg_publication_tables pt ON pt.pubname = p.pubname
    WHERE p.pubname = 'supabase_realtime' AND pt.schemaname = $1
    ORDER BY pt.tablename;
  `, [SCHEMA]).catch(() => []);
}

async function getRowCounts(client, tableNames) {
  const counts = {};
  for (const t of tableNames) {
    try {
      const rows = await q(client, `SELECT count(*)::bigint AS n FROM ${SCHEMA}."${t}"`);
      counts[t] = Number(rows[0].n);
    } catch (err) {
      counts[t] = `error: ${err.message}`;
    }
  }
  return counts;
}

// ── DDL reconstruction ──────────────────────────────────────────────

function formatColumnType(col) {
  const t = col.data_type;
  if (t === 'character varying') {
    return col.character_maximum_length ? `varchar(${col.character_maximum_length})` : 'varchar';
  }
  if (t === 'character') {
    return col.character_maximum_length ? `char(${col.character_maximum_length})` : 'char';
  }
  if (t === 'numeric' && col.numeric_precision != null) {
    return col.numeric_scale != null
      ? `numeric(${col.numeric_precision},${col.numeric_scale})`
      : `numeric(${col.numeric_precision})`;
  }
  if (t === 'ARRAY') return `${col.udt_name.replace(/^_/, '')}[]`;
  if (t === 'USER-DEFINED') return col.udt_name;
  return t;
}

function buildCreateTable(table, columns, constraints, indexes) {
  const cols = columns
    .filter(c => c.table_name === table.name)
    .sort((a, b) => a.ordinal_position - b.ordinal_position);

  const tcons = constraints.filter(c => c.table_name === table.name);

  const lines = [];
  if (table.comment) lines.push(`-- ${table.comment.replace(/\n/g, '\n-- ')}`);
  lines.push(`CREATE TABLE IF NOT EXISTS ${SCHEMA}.${table.name} (`);

  const colLines = cols.map(c => {
    let line = `  ${c.column_name} ${formatColumnType(c)}`;
    if (c.column_default) line += ` DEFAULT ${c.column_default}`;
    if (c.is_nullable === 'NO') line += ' NOT NULL';
    return line;
  });

  // primary key
  const pk = tcons.filter(c => c.constraint_type === 'PRIMARY KEY');
  if (pk.length) {
    const pkCols = [...new Set(pk.map(c => c.column_name))];
    colLines.push(`  CONSTRAINT ${pk[0].constraint_name} PRIMARY KEY (${pkCols.join(', ')})`);
  }

  // unique constraints (grouped)
  const uniqueByName = {};
  tcons.filter(c => c.constraint_type === 'UNIQUE').forEach(c => {
    (uniqueByName[c.constraint_name] ||= []).push(c.column_name);
  });
  for (const [name, ucols] of Object.entries(uniqueByName)) {
    colLines.push(`  CONSTRAINT ${name} UNIQUE (${[...new Set(ucols)].join(', ')})`);
  }

  // foreign keys (grouped)
  const fkByName = {};
  tcons.filter(c => c.constraint_type === 'FOREIGN KEY').forEach(c => {
    (fkByName[c.constraint_name] ||= { cols: [], ref: null, upd: c.update_rule, del: c.delete_rule });
    fkByName[c.constraint_name].cols.push(c.column_name);
    fkByName[c.constraint_name].ref = { table: c.foreign_table, column: c.foreign_column };
  });
  for (const [name, fk] of Object.entries(fkByName)) {
    let line = `  CONSTRAINT ${name} FOREIGN KEY (${[...new Set(fk.cols)].join(', ')}) ` +
               `REFERENCES ${SCHEMA}.${fk.ref.table} (${fk.ref.column})`;
    if (fk.upd && fk.upd !== 'NO ACTION') line += ` ON UPDATE ${fk.upd}`;
    if (fk.del && fk.del !== 'NO ACTION') line += ` ON DELETE ${fk.del}`;
    colLines.push(line);
  }

  // check constraints
  tcons.filter(c => c.constraint_type === 'CHECK' && c.check_clause &&
                    !/IS NOT NULL$/.test(c.check_clause.trim()))
    .forEach(c => {
      colLines.push(`  CONSTRAINT ${c.constraint_name} CHECK ${c.check_clause}`);
    });

  lines.push(colLines.join(',\n'));
  lines.push(');');

  // indexes that aren't the pk / unique-constraint-backed ones
  const idx = indexes.filter(i => i.tablename === table.name &&
    !i.indexname.endsWith('_pkey') && !uniqueByName[i.indexname]);
  for (const i of idx) {
    lines.push(`${i.indexdef};`);
  }

  return lines.join('\n');
}

// ── main ────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected (read-only introspection)...');

  // Sequential, not Promise.all — a single pg Client serializes concurrent
  // .query() calls and (pre-pg@9) can return them interleaved/garbled.
  const tables = await getTables(client);
  const columns = await getColumns(client);
  const constraints = await getConstraints(client);
  const indexes = await getIndexes(client);
  const views = await getViews(client);
  const functions = await getFunctions(client);
  const triggers = await getTriggers(client);
  const policies = await getPolicies(client);
  const rls = await getRlsEnabled(client);
  const realtime = await getRealtimePublication(client);

  const rowCounts = await getRowCounts(client, tables.map(t => t.name));
  await client.end();

  // ── crm_schema.json ──
  const json = {
    generated_at: new Date().toISOString(),
    schema: SCHEMA,
    tables, columns, constraints, indexes, views, functions, triggers, policies,
    rls, realtime_publication: realtime.map(r => r.tablename), row_counts: rowCounts,
  };
  const jsonPath = path.join(__dirname, 'crm_schema.json');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
  console.log(`Wrote ${jsonPath}`);

  // ── crm_schema.sql ──
  const out = [];
  out.push('-- =====================================================================');
  out.push('-- crm_schema.sql — RECONSTRUCTED from the live Supabase catalog by');
  out.push('-- introspect_schema.js. Do not hand-edit; regenerate instead.');
  out.push(`-- Generated: ${json.generated_at}`);
  out.push('-- =====================================================================');
  out.push('');

  out.push('-- ── TABLES ──────────────────────────────────────────────────────────');
  for (const t of tables) {
    out.push('');
    out.push(`-- rows at introspection time: ${rowCounts[t.name]}`);
    out.push(buildCreateTable(t, columns, constraints, indexes));
  }

  out.push('');
  out.push('-- ── VIEWS ───────────────────────────────────────────────────────────');
  for (const v of views) {
    out.push('');
    out.push(`CREATE OR REPLACE ${v.kind === 'm' ? 'MATERIALIZED VIEW' : 'VIEW'} ${SCHEMA}.${v.name} AS`);
    out.push(v.definition.trim().replace(/;?\s*$/, ';'));
  }

  out.push('');
  out.push('-- ── FUNCTIONS ───────────────────────────────────────────────────────');
  for (const f of functions) {
    out.push('');
    out.push(`-- ${f.name}(${f.args})  [${f.language}${f.security_definer ? ', SECURITY DEFINER' : ''}]`);
    out.push(f.definition.trim().replace(/;?\s*$/, ';'));
  }

  if (triggers.length) {
    out.push('');
    out.push('-- ── TRIGGERS ────────────────────────────────────────────────────────');
    for (const tg of triggers) {
      out.push('');
      out.push(`${tg.definition};`);
    }
  }

  out.push('');
  out.push('-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────');
  for (const r of rls) {
    if (r.rls_enabled) out.push(`ALTER TABLE ${SCHEMA}.${r.table_name} ENABLE ROW LEVEL SECURITY;`);
  }
  out.push('');
  for (const p of policies) {
    out.push(`-- policy ${p.policyname} on ${p.tablename}: ${p.cmd} for ${p.roles}`);
    let stmt = `CREATE POLICY ${p.policyname} ON ${SCHEMA}.${p.tablename}` +
               ` AS ${p.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'}` +
               ` FOR ${p.cmd} TO ${Array.isArray(p.roles) ? p.roles.join(', ') : p.roles}`;
    if (p.qual) stmt += `\n  USING (${p.qual})`;
    if (p.with_check) stmt += `\n  WITH CHECK (${p.with_check})`;
    out.push(stmt + ';');
    out.push('');
  }

  out.push('-- ── REALTIME PUBLICATION (supabase_realtime) ────────────────────────');
  for (const r of realtime) {
    out.push(`ALTER PUBLICATION supabase_realtime ADD TABLE ${SCHEMA}.${r.tablename};`);
  }
  out.push('');

  const sqlPath = path.join(__dirname, 'crm_schema.sql');
  fs.writeFileSync(sqlPath, out.join('\n'));
  console.log(`Wrote ${sqlPath}`);

  // ── console summary of what matters for the overhaul ──
  console.log('\nKey objects found:');
  for (const name of ['community_members_log', 'associates', 'vip_packages', 'commission_rules',
                      'payout_logs', 'concierge_user_states', 'referral_conversions']) {
    const found = tables.find(t => t.name === name);
    console.log(`  ${found ? '✓' : '✗'} ${name}${found ? `  (${rowCounts[name]} rows)` : ''}`);
  }
  for (const name of ['all_partners_view', 'affiliate_leaderboard_view']) {
    const found = views.find(v => v.name === name);
    console.log(`  ${found ? '✓' : '✗'} ${name} (view)`);
  }
}

main().catch(err => { console.error('Introspection failed:', err); process.exit(1); });
