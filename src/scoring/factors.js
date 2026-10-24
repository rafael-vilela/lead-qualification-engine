// Every factor is a small, pure function: signals in, { points, reason } out.
// Weights are explicit (maxPoints) and add up to 100, so any score can be
// audited by reading this one file.
//
// Two groups:
//   fit         - is this a real, active, established business?
//   opportunity - are there visible digital gaps an offering could address?

const unavailable = (what) => ({ points: 0, reason: `${what} data unavailable; not assessed` });

function byThreshold(value, steps) {
  for (const [min, points] of steps) {
    if (value >= min) return points;
  }
  return 0;
}

export const FACTORS = [
  {
    id: 'reputation',
    label: 'Established reputation',
    group: 'fit',
    maxPoints: 20,
    evaluate({ googleBusiness: gb }) {
      if (!gb) return unavailable('Google Business');
      const ratingPoints = byThreshold(gb.rating, [[4.5, 10], [4.0, 7], [3.5, 4]]);
      const reviewPoints = byThreshold(gb.reviewCount, [[200, 10], [50, 6], [10, 3]]);
      return {
        points: ratingPoints + reviewPoints,
        reason: `Rated ${gb.rating}/5 from ${gb.reviewCount} reviews on Google Business`,
      };
    },
  },
  {
    id: 'verified_profile',
    label: 'Complete business profile',
    group: 'fit',
    maxPoints: 10,
    evaluate({ googleBusiness: gb }) {
      if (!gb) return unavailable('Google Business');
      const points = (gb.claimed ? 6 : 0) + (gb.hasHours ? 4 : 0);
      const parts = [gb.claimed ? 'claimed' : 'not claimed', gb.hasHours ? 'opening hours listed' : 'no opening hours'];
      return { points, reason: `Google Business profile ${parts.join(', ')}` };
    },
  },
  {
    id: 'social_activity',
    label: 'Recent social activity',
    group: 'fit',
    maxPoints: 15,
    evaluate({ instagram: ig }) {
      if (!ig) return unavailable('Instagram');
      return {
        points: byThreshold(ig.postsLast30Days, [[12, 15], [4, 9], [1, 4]]),
        reason: `${ig.postsLast30Days} Instagram posts in the last 30 days`,
      };
    },
  },
  {
    id: 'audience',
    label: 'Audience size',
    group: 'fit',
    maxPoints: 15,
    evaluate({ instagram: ig }) {
      if (!ig) return unavailable('Instagram');
      return {
        points: byThreshold(ig.followers, [[5000, 15], [1000, 10], [200, 5]]),
        reason: `${ig.followers} Instagram followers`,
      };
    },
  },
  {
    id: 'website_gap',
    label: 'Website gap',
    group: 'opportunity',
    maxPoints: 20,
    evaluate({ website: site }) {
      if (!site) return unavailable('Website');
      if (!site.exists) return { points: 20, reason: 'No website found: clear opportunity for a web presence' };
      const issues = [];
      if (!site.https) issues.push('no HTTPS');
      if (!site.mobileFriendly) issues.push('not mobile-friendly');
      if (issues.length === 0) return { points: 0, reason: 'Website uses HTTPS and is mobile-friendly' };
      return { points: 12, reason: `Website has technical gaps: ${issues.join(', ')}` };
    },
  },
  {
    id: 'conversion_gap',
    label: 'Conversion path gap',
    group: 'opportunity',
    maxPoints: 10,
    evaluate({ website: site, instagram: ig }) {
      if (!site && !ig) return unavailable('Website and Instagram');
      let points = 0;
      const notes = [];
      if (site) {
        if (!site.exists) {
          points += 5;
          notes.push('no website to capture enquiries');
        } else if (!site.hasContactForm && !site.hasOnlineBooking) {
          points += 5;
          notes.push('no contact form or online booking on the website');
        } else {
          notes.push('website has a contact or booking path');
        }
      } else {
        notes.push('website data unavailable');
      }
      if (ig) {
        if (!ig.hasLinkInBio) {
          points += 5;
          notes.push('no link in Instagram bio');
        } else {
          notes.push('Instagram bio links out');
        }
      } else {
        notes.push('Instagram data unavailable');
      }
      return { points, reason: capitalize(notes.join('; ')) };
    },
  },
  {
    id: 'review_response_gap',
    label: 'Review response gap',
    group: 'opportunity',
    maxPoints: 10,
    evaluate({ googleBusiness: gb }) {
      if (!gb || gb.ownerResponseRate == null) return unavailable('Review response');
      const pct = Math.round(gb.ownerResponseRate * 100);
      const points = gb.ownerResponseRate < 0.3 ? 10 : gb.ownerResponseRate < 0.7 ? 5 : 0;
      return { points, reason: `Owner replies to ${pct}% of Google reviews` };
    },
  },
];

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
