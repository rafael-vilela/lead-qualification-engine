import { FACTORS } from './factors.js';

export { FACTORS };

export const TIER_THRESHOLDS = { high: 70, medium: 45 };
export const SOURCES = ['googleBusiness', 'website', 'instagram'];

export function tierFor(score) {
  if (score >= TIER_THRESHOLDS.high) return 'high';
  if (score >= TIER_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Score one lead from normalized signals ({ googleBusiness, website, instagram },
 * each an object or null). Pure and deterministic.
 */
export function scoreLead(signals) {
  const factors = FACTORS.map((factor) => {
    const { points, reason } = factor.evaluate(signals);
    return {
      id: factor.id,
      label: factor.label,
      group: factor.group,
      points: Math.min(factor.maxPoints, Math.max(0, points)),
      maxPoints: factor.maxPoints,
      reason,
    };
  });

  const warnings = [];
  const available = SOURCES.filter((s) => signals[s] != null).length;
  if (available < 2) {
    warnings.push(`Low data coverage (${available}/${SOURCES.length} sources); verify manually before outreach`);
  }

  const maxScore = FACTORS.reduce((sum, f) => sum + f.maxPoints, 0);

  if (signals.googleBusiness?.permanentlyClosed) {
    return {
      score: 0,
      maxScore,
      tier: 'disqualified',
      disqualified: true,
      disqualifiedReason: 'Business is marked as permanently closed on Google Business',
      factors,
      warnings,
    };
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  return { score, maxScore, tier: tierFor(score), disqualified: false, factors, warnings };
}
