# lead-qualification-engine

[![tests](https://github.com/rafael-vilela/lead-qualification-engine/actions/workflows/test.yml/badge.svg)](https://github.com/rafael-vilela/lead-qualification-engine/actions/workflows/test.yml)
![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![dependencies](https://img.shields.io/badge/dependencies-0-blue)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

> A small, **explainable** lead qualification engine. It gathers signals from three
> sources (Google Business, website, Instagram), scores each lead with transparent,
> documented factors, and returns the leads **ranked by priority, with the reasons**.

This is a reference implementation meant for learning and discussion. All source
adapters are **mocks** that read local, fictional data. There is no scraping, no
login, no social media automation and no network access.

---

## Why

Most lead scoring is a black box: a number comes out and nobody can say why. This
project shows the opposite approach:

- **Every point is traceable** to a named factor with a human-readable reason.
- **Weights live in one file** ([`src/scoring/factors.js`](src/scoring/factors.js)) and add up to 100.
- **Missing data is explicit**: unknown is never silently treated as good or bad.
- **Sources are pluggable**: swap a mock adapter for a real, authorized one without touching the scoring.

## Quick start

Requires Node.js 22+. No dependencies to install.

```bash
git clone https://github.com/rafael-vilela/lead-qualification-engine.git
cd lead-qualification-engine

npm test          # run the test suite
npm start         # score examples/sample-leads.json

# or point it at your own file
node bin/qualify-leads.js path/to/leads.json
```

## Architecture

```
            leads.json
                │
                ▼
     ┌─────────────────────┐
     │   qualifyLeads()    │  src/qualify.js
     └─────────────────────┘
                │  for each lead, ask every adapter for signals
     ┌──────────┼─────────────────┐
     ▼          ▼                 ▼
 Google      Website          Instagram       src/adapters/*
 Business    adapter          adapter         (mock: read lead.mockSources,
 adapter                                       normalize + validate)
     └──────────┼─────────────────┘
                ▼  normalized signals { googleBusiness, website, instagram }
     ┌─────────────────────┐
     │     scoreLead()     │  src/scoring/*
     │  7 pure factors     │  each → { points, reason }
     │  + disqualifiers    │
     │  + coverage check   │
     └─────────────────────┘
                │
                ▼
   ranked JSON with score, tier, priorityReason, factors
```

| Layer | Responsibility | Side effects |
|---|---|---|
| **Adapters** (`src/adapters/`) | Turn raw source data into clean, typed signals. Return `null` when a source has no data. | None (mocks read local JSON) |
| **Scoring** (`src/scoring/`) | Pure functions. Signals in, points + reasons out. | None |
| **Ranking** (`src/qualify.js`) | Orchestrates adapters, sorts, builds the priority explanation. | None |
| **CLI** (`bin/qualify-leads.js`) | Reads a file, prints JSON. | File read, stdout |

## Scoring model

Two groups of factors, 100 points total:

- **Fit**: is this a real, active, established business?
- **Opportunity**: are there visible digital gaps that a service could address?

| Factor | Group | Max | Source | How points are earned |
|---|---|---:|---|---|
| `reputation` | fit | 20 | Google Business | Rating ≥4.5 → 10, ≥4.0 → 7, ≥3.5 → 4; reviews ≥200 → 10, ≥50 → 6, ≥10 → 3 |
| `verified_profile` | fit | 10 | Google Business | Claimed → 6, opening hours listed → 4 |
| `social_activity` | fit | 15 | Instagram | Posts in last 30 days: ≥12 → 15, ≥4 → 9, ≥1 → 4 |
| `audience` | fit | 15 | Instagram | Followers: ≥5000 → 15, ≥1000 → 10, ≥200 → 5 |
| `website_gap` | opportunity | 20 | Website | No website → 20; missing HTTPS or not mobile-friendly → 12 |
| `conversion_gap` | opportunity | 10 | Website + Instagram | No contact form/booking (or no site) → 5; no link in bio → 5 |
| `review_response_gap` | opportunity | 10 | Google Business | Owner replies to <30% of reviews → 10, <70% → 5 |

**Tiers:** `high` ≥ 70, `medium` ≥ 45, `low` < 45.

**Disqualifier:** a business marked as permanently closed gets `tier: "disqualified"`,
score 0, and is always ranked last. Its factors are still reported for transparency.

**Data coverage:** if fewer than 2 of the 3 sources returned data, the lead gets a
warning to verify manually before any outreach.

**Ordering:** disqualified last → score (desc) → number of available sources (desc) → name (A–Z).
The output is fully deterministic.

> These thresholds are illustrative defaults, not a recommendation. Tune them to your
> own market and validate them against real outcomes before relying on them.

## Input

A JSON array of leads. Each lead needs a string `id` and `name`. The mock adapters
read `mockSources`; any source you omit is treated as **unknown**.

```json
{
  "id": "lead-001",
  "name": "Sunrise Bakery",
  "category": "bakery",
  "city": "Springfield",
  "mockSources": {
    "googleBusiness": { "rating": 4.7, "reviewCount": 312, "claimed": true, "hasHours": true, "ownerResponseRate": 0.1 },
    "website": { "exists": false },
    "instagram": { "followers": 2400, "postsLast30Days": 14, "hasLinkInBio": false }
  }
}
```

Note the difference between `"website": { "exists": false }` (we know there is no
website: an opportunity) and omitting `website` entirely (unknown: not assessed).

See [`examples/sample-leads.json`](examples/sample-leads.json) for 7 fictional leads.

## Output

`npm start` prints `{ count, leads: [...] }`, ranked. Summary of the sample run:

| Rank | Lead | Score | Tier | Why |
|---:|---|---:|---|---|
| 1 | Sunrise Bakery | 95 | high | Strong reviews, very active on Instagram, **no website** |
| 2 | Casa Verde Kitchen | 73 | high | Good reputation and audience, site lacks HTTPS / mobile support |
| 3 | Northside Dental Studio | 60 | medium | Excellent fit, but already digitally mature (little opportunity) |
| 4 | Lumen Yoga Loft | 55 | medium | Solid profile, no contact path on site or bio |
| 5 | Harbor Fitness | 50 | medium | Mid reputation, site has technical gaps |
| 6 | Maple Street Auto Repair | 21 | low | Only Google data available → coverage warning |
| 7 | Old Town Florist | 0 | disqualified | Permanently closed |

One full entry:

```json
{
  "rank": 1,
  "id": "lead-001",
  "name": "Sunrise Bakery",
  "score": 95,
  "maxScore": 100,
  "tier": "high",
  "priorityReason": "High priority (95/100): Rated 4.7/5 from 312 reviews on Google Business (+20); No website found: clear opportunity for a web presence (+20); 14 Instagram posts in the last 30 days (+15)",
  "dataCoverage": { "available": ["googleBusiness", "website", "instagram"], "missing": [] },
  "warnings": [],
  "factors": [
    { "id": "reputation", "label": "Established reputation", "group": "fit", "points": 20, "maxPoints": 20, "reason": "Rated 4.7/5 from 312 reviews on Google Business" },
    { "id": "verified_profile", "label": "Complete business profile", "group": "fit", "points": 10, "maxPoints": 10, "reason": "Google Business profile claimed, opening hours listed" },
    { "id": "social_activity", "label": "Recent social activity", "group": "fit", "points": 15, "maxPoints": 15, "reason": "14 Instagram posts in the last 30 days" },
    { "id": "audience", "label": "Audience size", "group": "fit", "points": 10, "maxPoints": 15, "reason": "2400 Instagram followers" },
    { "id": "website_gap", "label": "Website gap", "group": "opportunity", "points": 20, "maxPoints": 20, "reason": "No website found: clear opportunity for a web presence" },
    { "id": "conversion_gap", "label": "Conversion path gap", "group": "opportunity", "points": 10, "maxPoints": 10, "reason": "No website to capture enquiries; no link in Instagram bio" },
    { "id": "review_response_gap", "label": "Review response gap", "group": "opportunity", "points": 10, "maxPoints": 10, "reason": "Owner replies to 10% of Google reviews" }
  ]
}
```

The complete output is committed at [`examples/sample-output.json`](examples/sample-output.json),
and a test guarantees it stays in sync with the code.

## Use as a library

```js
import { qualifyLeads } from './src/index.js';

const { leads } = await qualifyLeads(myLeads);
console.log(leads[0].priorityReason);
```

### Plugging in your own source

An adapter is any object with a `source` name and an async `fetchSignals(lead)` that
returns normalized signals or `null`:

```js
const myWebsiteAdapter = {
  source: 'website',
  async fetchSignals(lead) {
    // e.g. read from your own database or a previously exported audit
    return { exists: true, https: true, mobileFriendly: false, hasContactForm: true, hasOnlineBooking: false };
  },
};

await qualifyLeads(myLeads, { adapters: [googleBusinessAdapter, myWebsiteAdapter, instagramAdapter] });
```

The scoring layer only sees normalized signals, so it does not care where they came from.

## Testing

Built test-first with the Node.js built-in test runner (`node:test`), no dependencies.

```bash
npm test
```

The suite covers adapter normalization and validation, every scoring factor, tiers,
disqualification, missing-data handling, deterministic ranking, adapter injection, a
guard that fails if any code calls `fetch`, and the CLI end to end.

## Ethics, data and limitations

Please read this before adapting the project to real data.

- **Mock data only.** Every business, number and domain in this repo is fictional.
  Domains use the reserved `.example` TLD ([RFC 2606](https://www.rfc-editor.org/rfc/rfc2606)).
- **No scraping, no automation.** If you connect real sources, use official APIs or
  data you are authorized to use, and follow each platform's terms of service and
  rate limits. Do not automate logins or interactions on social networks.
- **Business signals, not people.** The model scores public business attributes. Do not
  extend it to profile individuals or infer sensitive characteristics.
- **Privacy law applies.** Collecting and processing lead data may fall under laws
  such as GDPR or Brazil's LGPD. Have a lawful basis, minimize what you store, and
  honor opt-out and deletion requests.
- **A score is a prioritization aid, not a verdict.** Thresholds are illustrative and
  untested against real conversion data. Keep a human in the loop, especially for
  leads with coverage warnings.
- **Bias.** Signals like follower count or review volume favor businesses that are
  already visible online. Small or new businesses may be under-ranked on fit while
  being the ones that benefit most. Review the weights with that in mind.
- **Point-in-time.** Signals go stale. Record when data was collected if you use this
  for real decisions.

## Project structure

```
bin/qualify-leads.js          CLI entry point
src/index.js                  public exports
src/qualify.js                orchestration, ranking, priority explanation
src/scoring/factors.js        the 7 scoring factors (weights + reasons)
src/scoring/index.js          scoreLead, tiers, disqualifiers, coverage warnings
src/adapters/                 mock Google Business, website and Instagram adapters
examples/sample-leads.json    fictional input
examples/sample-output.json   output produced by the CLI
test/                         node:test suites
```

## License

[MIT](LICENSE)
