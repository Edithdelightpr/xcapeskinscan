import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MessageCircle, ArrowLeft } from 'lucide-react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import { BANK_DETAILS } from '@/lib/bankDetails';
import { BRAND } from '@/lib/brand';
import { openWhatsApp, buildOrderConfirmationMessage } from '@/lib/whatsapp';
import PageReveal from '@/components/public/PageReveal';

const CheckoutThanks = () => {
  const [params] = useSearchParams();
  const ref = params.get('ref') ?? '';

  const reopenWhatsApp = () => {
    const message = buildOrderConfirmationMessage({
      brandName: BRAND.name,
      customerName: '(please confirm my details)',
      orderRef: ref || null,
      bank: {
        bank: BANK_DETAILS.bank,
        accountNumber: BANK_DETAILS.accountNumber,
        accountName: BANK_DETAILS.accountName,
      },
      extraNote: 'I am following up on payment confirmation for the order above.',
    });
    openWhatsApp(BRAND.whatsapp, message);
  };

  return (
    <PageReveal>
    <div className="min-h-screen gradient-primary">
      <PublicTopNav />
      <main className="pt-24 pb-16 max-w-2xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-card p-8 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h1 className="text-2xl md:text-3xl font-display font-bold">Order received</h1>
          {ref && (
            <p className="text-sm text-muted-foreground">
              Order reference: <span className="font-mono font-semibold text-foreground">{ref}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Please complete your bank transfer if you haven't already. Our team will confirm your payment and contact you to arrange delivery.
          </p>

          <div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-left space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-accent font-semibold">Bank transfer details</p>
            <p className="text-sm"><span className="text-muted-foreground">Bank:</span> <span className="font-semibold">{BANK_DETAILS.bank}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Account number:</span> <span className="font-mono font-semibold">{BANK_DETAILS.accountNumber}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Account name:</span> <span className="font-semibold">{BANK_DETAILS.accountName}</span></p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={reopenWhatsApp} className="flex-1 gap-2">
              <MessageCircle className="w-4 h-4" /> Message us on WhatsApp
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/tropixa"><ArrowLeft className="w-4 h-4 mr-1" /> Back to shop</Link>
            </Button>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default CheckoutThanks;