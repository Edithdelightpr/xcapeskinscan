import { describe, expect, it } from 'vitest';
import {
  COMM_BANDS,
  LANGUAGE_STAGES,
  LANGUAGE_VARIABLE_KEYS,
  REPORT_COPY_BANK_V2,
  clientCopyFor,
  communicationBandFor,
  isActiveConcern,
  languageStageFor,
  prioritySynthesis,
} from '@/lib/xcapeReportLanguage';
import {
  PLATFORM_REPORT_CURRENCY,
  formatMoney,
  resolveReportCurrency,
} from '@/lib/xcapeRetail';

/**
 * Release guard for xcape-report-language-v2. The client-facing copy bank is
 * the only place unreviewed claims can reach a client, so band boundaries,
 * completeness and safety are all pinned here.
 */
describe('communication bands', () => {
  it('covers 0-100 with no gap or overlap', () => {
    expect(COMM_BANDS[0].range[0]).toBe(0);
    expect(COMM_BANDS[COMM_BANDS.length - 1].range[1]).toBe(100);
    for (let i = 1; i < COMM_BANDS.length; i++) {
      expect(COMM_BANDS[i].range[0]).toBe(COMM_BANDS[i - 1].range[1] + 1);
    }
  });

  it('resolves the exact boundary scores to the right band', () => {
    const cases: Array<[number, string]> = [
      [0, 'priority'], [20, 'priority'],
      [21, 'active'], [40, 'active'],
      [41, 'correction'], [60, 'correction'],
      [61, 'watch'], [80, 'watch'],
      [81, 'maintenance'], [89, 'maintenance'],
      [90, 'healthy'], [100, 'healthy'],
    ];
    for (const [score, band] of cases) {
      expect(communicationBandFor(score).band, `score ${score}`).toBe(band);
    }
  });

  it('is Healthy if and only if the score is 90 or above, for every integer 0-100', () => {
    for (let s = 0; s <= 100; s++) {
      const label = communicationBandFor(s).label;
      expect(label === 'Healthy', `score ${s} label ${label}`).toBe(s >= 90);
      expect(isActiveConcern(s), `active at ${s}`).toBe(s < 90);
    }
  });

  it('pins 89 as a maintenance concern and 90 as the first Healthy score', () => {
    expect(communicationBandFor(89).label).toBe('Maintenance concern');
    expect(isActiveConcern(89)).toBe(true);
    expect(communicationBandFor(90).label).toBe('Healthy');
    expect(isActiveConcern(90)).toBe(false);
  });

  it('uses no minimising or healthy-sounding status label below 90', () => {
    const banned = ['minimal concern', 'mild concern', 'improving', 'optimal', 'stable', 'strong', 'healthy'];
    for (let s = 0; s < 90; s++) {
      const label = communicationBandFor(s).label.toLowerCase();
      for (const word of banned) {
        expect(label.includes(word), `score ${s} label "${label}" contains "${word}"`).toBe(false);
      }
    }
  });

  it('clamps out-of-range scores instead of throwing', () => {
    expect(communicationBandFor(-40).band).toBe('priority');
    expect(communicationBandFor(400).band).toBe('healthy');
  });
});

describe('copy bank completeness', () => {
  it('has all 4 variables x 10 stages = 40 entries, each fully populated', () => {
    let count = 0;
    for (const key of LANGUAGE_VARIABLE_KEYS) {
      for (const { stage } of LANGUAGE_STAGES) {
        const entry = REPORT_COPY_BANK_V2[key][stage];
        expect(entry, `${key}/${stage}`).toBeTruthy();
        for (const field of [
          'detected', 'whyItMatters', 'ifLeftUnsupported', 'xcapeResponse', 'reassurance',
        ] as const) {
          expect(
            typeof entry[field] === 'string' && entry[field].trim().length > 0,
            `${key}/${stage}/${field}`,
          ).toBe(true);
        }
        count += 1;
      }
    }
    expect(count).toBe(40);
  });

  it('selects copy from the raw score at every stage boundary', () => {
    for (const { stage, range } of LANGUAGE_STAGES) {
      expect(languageStageFor(range[0])).toBe(stage);
      expect(languageStageFor(range[1])).toBe(stage);
    }
    expect(clientCopyFor('pigmentation_stability', 5))
      .toEqual(REPORT_COPY_BANK_V2.pigmentation_stability.critical);
  });
});

describe('client-copy safety', () => {
  const allStrings = () => {
    const out: string[] = [];
    for (const key of LANGUAGE_VARIABLE_KEYS) {
      for (const { stage } of LANGUAGE_STAGES) {
        out.push(...Object.values(REPORT_COPY_BANK_V2[key][stage]));
      }
    }
    for (let s = 0; s <= 100; s += 5) {
      const syn = prioritySynthesis({
        pigmentation_stability: s,
        barrier_surface_hydration: s,
        firmness_skin_support: s,
        oil_congestion_balance: s,
      });
      out.push(syn.headline, ...syn.lines);
    }
    return out;
  };

  it('contains no diagnosis, guarantee, absorption or sub-surface claims', () => {
    const forbidden = [
      /\bdiagnos/i,
      /\bguarantee/i,
      /\bcure[sd]?\b/i,
      /\btreats?\b/i,
      /\bmedical\b/i,
      /\bdisease\b/i,
      /\babsorb/i,
      /\bpenetrat/i,
      /\bdermis\b/i, /\bdermal\b/i,
      /\bcollagen\b/i,
      /\bsub-?surface\b/i,
      /\bbounce[- ]?back\b/i,
      /barrier is doing its job/i,
      /\baggressive\b/i,
      /industry standard/i,
    ];
    for (const text of allStrings()) {
      for (const pattern of forbidden) {
        expect(pattern.test(text), `"${text}" matched ${pattern}`).toBe(false);
      }
    }
  });

  it('uses no em dashes in any client-facing string', () => {
    for (const text of allStrings()) {
      expect(text.includes('\u2014'), `em dash in "${text}"`).toBe(false);
    }
  });
});

describe('priority synthesis', () => {
  it('names the weakest area first', () => {
    const syn = prioritySynthesis({
      pigmentation_stability: 88,
      barrier_surface_hydration: 30,
      firmness_skin_support: 74,
      oil_congestion_balance: 66,
    });
    expect(syn.allStable).toBe(false);
    expect(syn.weakest[0]).toBe('barrier_surface_hydration');
    expect(syn.lines.join(' ').toLowerCase()).toContain('surface dehydration');
  });

  it('uses a maintenance headline when every reading is stable', () => {
    const syn = prioritySynthesis({
      pigmentation_stability: 92,
      barrier_surface_hydration: 95,
      firmness_skin_support: 90,
      oil_congestion_balance: 93,
    });
    expect(syn.allStable).toBe(true);
    expect(syn.headline.toLowerCase().includes('maintenance focus')).toBe(true);
    expect(syn.headline.toLowerCase()).not.toContain('needs attention');
    // Even when stable it must still name a focus area, never claim perfection.
    expect(syn.weakest.length).toBeGreaterThan(0);
  });

  it('treats an 81-89 reading as needing attention, never as all stable', () => {
    const syn = prioritySynthesis({
      pigmentation_stability: 89,
      barrier_surface_hydration: 95,
      firmness_skin_support: 96,
      oil_congestion_balance: 97,
    });
    expect(syn.allStable).toBe(false);
    expect(syn.weakest[0]).toBe('pigmentation_stability');
    expect(syn.headline.toLowerCase()).toContain('needs attention');
  });

  it('leads every 81-89 detected line with the remaining visible shortcoming', () => {
    for (const key of LANGUAGE_VARIABLE_KEYS) {
      const detected = clientCopyFor(key, 85).detected.toLowerCase();
      expect(/still visible|still be seen/.test(detected), `${key}: ${detected}`).toBe(true);
      expect(/nothing in this capture|no visible|no meaningful/.test(detected), key).toBe(false);
    }
  });

  it('returns a safe empty synthesis with no scores', () => {
    const syn = prioritySynthesis({});
    expect(syn.weakest).toEqual([]);
    expect(syn.overall).toBeNull();
  });
});

describe('shared currency helper', () => {
  it('defaults to the single platform currency', () => {
    expect(PLATFORM_REPORT_CURRENCY).toBe('XAF');
    expect(resolveReportCurrency(null)).toBe('XAF');
    expect(resolveReportCurrency('  ')).toBe('XAF');
    expect(resolveReportCurrency('not-a-code')).toBe('XAF');
    expect(resolveReportCurrency('ngn')).toBe('NGN');
  });

  it('formats XAF, NGN and generic codes', () => {
    expect(formatMoney(15000, 'XAF')).toBe('15,000 FCFA');
    expect(formatMoney(25000, 'XAF')).toBe('25,000 FCFA');
    expect(formatMoney(15000, 'NGN')).toBe('₦15,000');
    expect(formatMoney(15000, 'NGN', { ascii: true })).toBe('NGN 15,000');
    expect(formatMoney(1500, 'EUR')).toBe('1,500 EUR');
  });

  it('never renders an absent amount as free', () => {
    expect(formatMoney(null)).toBe('Not available');
    expect(formatMoney(undefined, 'XAF', { placeholder: 'Price on request' }))
      .toBe('Price on request');
  });
});
