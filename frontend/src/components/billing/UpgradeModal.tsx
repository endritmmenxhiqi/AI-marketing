import { BillingConfig, createCheckoutSession } from '../../lib/api';

export default function UpgradeModal({
  open,
  billing,
  onClose,
}: {
  open: boolean;
  billing: BillingConfig | null;
  onClose: () => void;
}) {
  if (!open || !billing) {
    return null;
  }

  const startCheckout = async (mode: 'credits' | 'subscription', pack?: number) => {
    const session = await createCheckoutSession({ mode, pack });
    if (session.url) {
      window.location.href = session.url;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-6 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">Upgrade Credits</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400">Free</div>
            <div className="mt-2 text-2xl font-black">{billing.free.starterCredits} credits</div>
            <p className="mt-2 text-xs text-slate-400">Starter wallet for every new account.</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4">
            <div className="text-xs font-black uppercase tracking-wider text-emerald-300">Premium</div>
            <div className="mt-2 text-2xl font-black">Priority queue</div>
            <p className="mt-2 text-xs text-emerald-200/80">Optional subscription for faster job processing.</p>
            <button
              type="button"
              onClick={() => {
                void startCheckout('subscription');
              }}
              className="mt-4 w-full rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-900"
            >
              Start premium
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400">Credit Packs</div>
            <div className="mt-3 space-y-2">
              {billing.creditPacks.map((pack) => (
                <button
                  key={pack.credits}
                  type="button"
                  onClick={() => {
                    void startCheckout('credits', pack.credits);
                  }}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-left text-xs font-bold hover:bg-white/20"
                >
                  Buy {pack.credits} credits
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
