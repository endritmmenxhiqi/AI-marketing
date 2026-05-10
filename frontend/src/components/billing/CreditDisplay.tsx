import { CreditState } from '../../lib/api';

export default function CreditDisplay({
  credits,
  lowThreshold,
  onUpgrade,
}: {
  credits: CreditState | null;
  lowThreshold: number;
  onUpgrade: () => void;
}) {
  if (!credits) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
        Loading credit wallet...
      </div>
    );
  }

  const lowCredits = credits.credits <= lowThreshold;
  const noCredits = credits.credits <= 0;

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Credit Wallet</div>
        <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
          {credits.role === 'premium' ? 'Premium' : 'Free'}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
        <div className="text-[9px] uppercase tracking-wider text-slate-400">Remaining Credits</div>
        <div className="mt-1 text-3xl font-black text-white">{credits.credits}</div>
      </div>

      <div className="text-[10px] font-semibold text-slate-400">
        Total generations: <span className="text-white">{credits.totalGenerations}</span>
      </div>

      {noCredits ? (
        <div className="rounded-xl border border-rose-300/40 bg-rose-400/15 px-3 py-2 text-[10px] font-bold text-rose-100">
          You&apos;ve used all your credits.
        </div>
      ) : null}

      {lowCredits ? (
        <button
          type="button"
          onClick={onUpgrade}
          className="w-full rounded-xl bg-amber-400 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900 transition-colors hover:bg-amber-300"
        >
          Buy credits
        </button>
      ) : null}
    </div>
  );
}
