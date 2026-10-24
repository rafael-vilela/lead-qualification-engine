import { createMockAdapters } from './adapters/index.js';
import { scoreLead } from './scoring/index.js';

const TIER_LABELS = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };
const TOP_DRIVERS = 3;

/**
 * Collect signals for every lead, score them and return them ranked.
 *
 * @param {Array<{id: string, name: string}>} leads
 * @param {{ adapters?: Array<{ source: string, fetchSignals(lead): Promise<object|null> }> }} [options]
 */
export async function qualifyLeads(leads, { adapters = createMockAdapters() } = {}) {
  validateLeads(leads);

  const scored = await Promise.all(
    leads.map(async (lead) => {
      const results = await Promise.all(adapters.map((adapter) => adapter.fetchSignals(lead)));
      const signals = Object.fromEntries(adapters.map((adapter, i) => [adapter.source, results[i] ?? null]));
      const dataCoverage = {
        available: adapters.filter((a) => signals[a.source] != null).map((a) => a.source),
        missing: adapters.filter((a) => signals[a.source] == null).map((a) => a.source),
      };
      const result = scoreLead(signals);
      return {
        id: lead.id,
        name: lead.name,
        score: result.score,
        maxScore: result.maxScore,
        tier: result.tier,
        priorityReason: explainPriority(result),
        dataCoverage,
        warnings: result.warnings,
        factors: result.factors,
      };
    }),
  );

  scored.sort(compareLeads);
  return { count: scored.length, leads: scored.map((lead, i) => ({ rank: i + 1, ...lead })) };
}

function compareLeads(a, b) {
  const aOut = a.tier === 'disqualified' ? 1 : 0;
  const bOut = b.tier === 'disqualified' ? 1 : 0;
  return (
    aOut - bOut ||
    b.score - a.score ||
    b.dataCoverage.available.length - a.dataCoverage.available.length ||
    a.name.localeCompare(b.name, 'en')
  );
}

function explainPriority(result) {
  if (result.disqualified) return `Disqualified: ${result.disqualifiedReason}`;
  const head = `${TIER_LABELS[result.tier]} (${result.score}/${result.maxScore})`;
  const drivers = result.factors
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_DRIVERS)
    .map((f) => `${f.reason} (+${f.points})`);
  if (drivers.length === 0) return `${head}: no positive signals found`;
  return `${head}: ${drivers.join('; ')}`;
}

function validateLeads(leads) {
  if (!Array.isArray(leads)) throw new TypeError('Expected an array of leads');
  leads.forEach((lead, i) => {
    if (!lead || typeof lead !== 'object') throw new TypeError(`Lead at index ${i} must be an object`);
    for (const field of ['id', 'name']) {
      if (typeof lead[field] !== 'string' || lead[field].trim() === '') {
        throw new TypeError(`Lead at index ${i} is missing a non-empty string "${field}"`);
      }
    }
  });
}
