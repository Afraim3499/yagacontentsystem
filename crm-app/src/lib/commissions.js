// One commission calculator for the whole CRM.
//
// Replaces the `val * 0.05` / `val * 0.25` constants that were hand-copied
// into ~8 places in VipMembersDeskView.jsx and once in
// MemberTrackingDeskView.jsx. Rates resolve: per-associate override →
// commission_rules (RULE-DEFAULT) → built-in default.

export const DEFAULT_RATES = {
  associate_pct: 5,     // % of the subscription value paid to the referring associate
  kabidul_pct: 25,      // % management cut ("Kabidul")
  free_rate: 0.30,      // $ per free-group join
};

/**
 * @param associate  a row from `associates` (or null / undefined for direct)
 * @param rules      the `commission_rules` RULE-DEFAULT row (or null)
 */
export function resolveRates(associate, rules) {
  const r = rules || {};
  const associatePct = associate?.paid_commission_pct;
  const rulesPct = r.paid_commission_pct;
  return {
    associate_pct: Number(associatePct ?? rulesPct ?? DEFAULT_RATES.associate_pct),
    kabidul_pct: Number(r.kabidul_pct ?? DEFAULT_RATES.kabidul_pct),
    free_rate: Number(
      associate?.free_commission_rate ??
      (r.free_rate_per_100 != null ? Number(r.free_rate_per_100) / 100 : DEFAULT_RATES.free_rate),
    ),
    source: associatePct != null ? 'associate' : rulesPct != null ? 'commission_rules' : 'default',
  };
}

/**
 * @param gross  the subscription value being paid
 * @param rates  from resolveRates()
 * @returns { associate_commission, kabidul_commission, snapshot }
 */
export function calcCommissions(gross, rates) {
  const g = Number(gross) || 0;
  return {
    associate_commission: Number((g * rates.associate_pct / 100).toFixed(2)),
    kabidul_commission: Number((g * rates.kabidul_pct / 100).toFixed(2)),
    snapshot: {
      gross: g,
      associate_pct: rates.associate_pct,
      kabidul_pct: rates.kabidul_pct,
      free_rate: rates.free_rate,
      rate_source: rates.source,
      resolved_at: new Date().toISOString(),
    },
  };
}
