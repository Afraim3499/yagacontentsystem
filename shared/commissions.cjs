// Bot-side commission calculator — mirror of crm-app/src/lib/commissions.js.
// Pure functions + a DB resolver that uses the engine's runQuery(text, params).

const DEFAULT_RATES = { associate_pct: 5, kabidul_pct: 25, free_rate: 0.30 };

function resolveRates(associate, rules) {
  const r = rules || {};
  const associatePct = associate && associate.paid_commission_pct;
  const rulesPct = r.paid_commission_pct;
  return {
    associate_pct: Number(associatePct != null ? associatePct : (rulesPct != null ? rulesPct : DEFAULT_RATES.associate_pct)),
    kabidul_pct: Number(r.kabidul_pct != null ? r.kabidul_pct : DEFAULT_RATES.kabidul_pct),
    free_rate: Number(
      (associate && associate.free_commission_rate != null) ? associate.free_commission_rate
        : (r.free_rate_per_100 != null ? Number(r.free_rate_per_100) / 100 : DEFAULT_RATES.free_rate),
    ),
    source: associatePct != null ? 'associate' : (rulesPct != null ? 'commission_rules' : 'default'),
  };
}

function calcCommissions(gross, rates) {
  const g = Number(gross) || 0;
  return {
    associate_commission: Number((g * rates.associate_pct / 100).toFixed(2)),
    kabidul_commission: Number((g * rates.kabidul_pct / 100).toFixed(2)),
    snapshot: {
      gross: g, associate_pct: rates.associate_pct, kabidul_pct: rates.kabidul_pct,
      free_rate: rates.free_rate, rate_source: rates.source, resolved_at: new Date().toISOString(),
    },
  };
}

// Load rates for an associate id straight from the DB (non-throwing).
async function resolveRatesFromDb(runQuery, associateId) {
  let associate = null;
  let rules = null;
  try {
    if (associateId) {
      const a = await runQuery(`SELECT paid_commission_pct, free_commission_rate FROM public.associates WHERE id = $1`, [associateId]);
      associate = a.rows[0] || null;
    }
    const r = await runQuery(`SELECT free_rate_per_100, paid_commission_pct FROM public.commission_rules WHERE id = 'RULE-DEFAULT'`);
    rules = r.rows[0] || null;
  } catch (err) {
    console.error('resolveRatesFromDb failed, using defaults:', err.message);
  }
  return resolveRates(associate, rules);
}

module.exports = { DEFAULT_RATES, resolveRates, calcCommissions, resolveRatesFromDb };
