import { config } from '../config';

export type CheckoutMode = 'credits' | 'subscription';
export type CreditPackSize = 10 | 50 | 100;

export type CreditPackDefinition = {
  credits: CreditPackSize;
  priceId: string;
  unitAmountCents?: number;
};

export const billingCatalog = {
  creditPacks: [
    {
      credits: 10,
      priceId: config.stripeCreditPack10PriceId,
      unitAmountCents: Number(process.env.STRIPE_CREDIT_PACK_10_AMOUNT_CENTS || 900),
    },
    {
      credits: 50,
      priceId: config.stripeCreditPack50PriceId,
      unitAmountCents: Number(process.env.STRIPE_CREDIT_PACK_50_AMOUNT_CENTS || 1900),
    },
    {
      credits: 100,
      priceId: config.stripeCreditPack100PriceId,
      unitAmountCents: Number(process.env.STRIPE_CREDIT_PACK_100_AMOUNT_CENTS || 3400),
    }
  ] satisfies CreditPackDefinition[],
  premium: {
    priceId: config.stripePremiumPriceId,
  },
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');
let stripeClient: any = null;

export const getStripeClient = () => {
  if (!config.stripeSecretKey) {
    const error = new Error('Stripe secret key is not configured.');
    (error as any).statusCode = 500;
    throw error;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(config.stripeSecretKey, {
      typescript: true,
    });
  }

  return stripeClient;
};

export const resolveCreditPack = (pack: number) => {
  const found = billingCatalog.creditPacks.find((item) => item.credits === pack);
  if (!found) {
    const error = new Error('Unsupported credit pack selected.');
    (error as any).statusCode = 400;
    throw error;
  }

  if (!found.priceId) {
    const error = new Error(`Stripe price id is missing for ${pack} credit pack.`);
    (error as any).statusCode = 500;
    throw error;
  }

  return found;
};

export const getBillingConfig = () => ({
  free: {
    starterCredits: config.initialUserCredits,
  },
  premium: {
    priority: true,
    priceId: billingCatalog.premium.priceId,
  },
  creditPacks: billingCatalog.creditPacks,
});
