// Shared Tailwind class fragments matching the DSS design language
// (see app/dss/stp/wwt/stp_suitability_v2 for the reference implementation).

export const sectionCard =
  'rounded-3xl border border-stone-200 bg-white/80 shadow-[0_16px_34px_rgba(148,163,184,0.12)]';

export const innerCard =
  'rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,#fbfaf7_0%,#f3f7f5_100%)] p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_rgba(148,163,184,0.10)]';

export const itemCard =
  'rounded-xl border border-stone-200 bg-stone-50/65 p-3 transition-all duration-200 hover:-translate-y-[1px] hover:border-stone-300 hover:bg-white/90 hover:shadow-[0_8px_18px_rgba(148,163,184,0.14)] sm:p-3.5';

export const itemCardActive =
  'rounded-xl border border-l-[3px] border-blue-200 border-l-emerald-400 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f7f5_100%)] p-3 shadow-[0_0_0_1px_rgba(191,219,254,0.45),0_10px_22px_rgba(148,163,184,0.14)] transition-all duration-200 hover:-translate-y-[1px] hover:border-blue-300 sm:p-3.5';

export const sectionTitle =
  'border-l-2 border-l-teal-400 pl-2 text-sm font-semibold text-slate-900';

export const smallLabel =
  'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';

export const helpText = 'text-[11px] text-slate-500 sm:text-xs';

export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none sm:px-6 sm:py-2.5 sm:text-sm';

export const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 sm:px-6 sm:py-2.5 sm:text-sm';

export const destructiveButton =
  'inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:py-2.5 sm:text-sm';

export const pillTabsWrapper = 'flex flex-wrap items-center gap-2 rounded-2xl bg-stone-50 p-1';

export const pillTabActive = 'rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm sm:px-3 sm:text-xs';

export const pillTabInactive = 'rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white/70 sm:px-3 sm:text-xs';

export const banner = {
  info: 'rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 sm:text-xs',
  success: 'rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 sm:text-xs',
  warning: 'rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 sm:text-xs',
  error: 'rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 sm:text-xs',
};

export const infoBadge =
  'inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-[8px] font-bold text-amber-900';

// Standard numeric/text input styling used across scenario input forms —
// adds a visible hover state and emerald focus ring on top of the shared
// shadcn Input primitive.
export const numberInput =
  'rounded-lg border-stone-200 transition-colors hover:border-stone-300 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/40';
