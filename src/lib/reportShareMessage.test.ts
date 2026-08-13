import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReportShareMessage, whatsAppShareUrl } from './reportShareMessage';
import { buildShareMessage } from '@/components/admin/ShareReportDialog';
import { BRAND } from '@/lib/brand';

describe('reportShareMessage', () => {
  it('is byte-identical to the edge function copy', () => {
    const app = readFileSync(resolve(__dirname, 'reportShareMessage.ts'), 'utf8');
    const edge = readFileSync(
      resolve(__dirname, '../../supabase/functions/_shared/reportShareMessage.ts'),
      'utf8',
    );
    expect(edge).toBe(app);
  });

  it('always leads with the greeting then the report URL', () => {
    const msg = buildReportShareMessage({
      firstName: 'Ada',
      reportUrl: 'https://xcapeskinscan.lovable.app/report/abc',
    });
    const blocks = msg.split('\n\n');
    expect(blocks[0]).toBe('Hi Ada, here is your XCAPE skin analysis report:');
    expect(blocks[1]).toBe('https://xcapeskinscan.lovable.app/report/abc');
  });

  it('falls back to a neutral greeting without a name', () => {
    expect(buildReportShareMessage({ firstName: '  ', reportUrl: 'u' })).toContain('Hi there,');
  });

  it('includes clinic contact, promo and referral in the agreed order', () => {
    const msg = buildReportShareMessage({
      firstName: 'Ada',
      reportUrl: 'u',
      clinicAddress: 'House 8, Abuja',
      clinicPhone: '+234 803 769 6910',
      promoCode: 'ADA10',
      promoPct: 10,
      referralLink: 'https://x.test/ada',
    });
    const blocks = msg.split('\n\n');
    expect(blocks[2]).toBe('Visit us at House 8, Abuja. Call +234 803 769 6910.');
    expect(blocks[3]).toBe('Use my promo code ADA10 for 10% off your first visit.');
    expect(blocks[4]).toBe('Book with me directly: https://x.test/ada');
  });

  it('drops the percentage wording when no discount is set', () => {
    const msg = buildReportShareMessage({
      firstName: 'Ada',
      reportUrl: 'u',
      promoCode: 'ADA',
      promoPct: null,
    });
    expect(msg).toContain('Use my promo code ADA at the front desk for a special benefit.');
  });

  it('omits optional blocks entirely when absent', () => {
    const msg = buildReportShareMessage({ firstName: 'Ada', reportUrl: 'u' });
    expect(msg.split('\n\n')).toHaveLength(2);
  });

  it('is the same text the staff share dialog produces', () => {
    const first = 'Ada';
    const reportUrl = 'https://xcapeskinscan.lovable.app/report/abc';
    expect(
      buildShareMessage({ first, reportUrl, promoCode: null, promoPct: null, referralLink: null }),
    ).toBe(
      buildReportShareMessage({
        firstName: first,
        reportUrl,
        clinicAddress: `${BRAND.address.line1}, ${BRAND.address.city}`,
        clinicPhone: BRAND.phone,
      }),
    );
  });

  it('builds a wa.me link from the exact share text', () => {
    const text = buildReportShareMessage({ firstName: 'Ada', reportUrl: 'u' });
    const url = whatsAppShareUrl('+234 803 769 6910', text);
    expect(url.startsWith('https://wa.me/2348037696910?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(text);
  });
});
