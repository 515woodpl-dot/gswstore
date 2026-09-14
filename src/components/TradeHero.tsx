import Link from "next/link";

export default function TradeHero() {
  return (
    <section className="sps-grid-texture bg-[#fbfaf7]">
      <div className="mx-auto grid max-w-7xl lg:min-h-[650px] lg:grid-cols-[0.88fr_1.12fr]">
        <div className="flex flex-col justify-center px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Built for fabricators &amp; installers</p>
          <h1 className="font-display text-[clamp(3.6rem,7vw,6.8rem)] font-black uppercase leading-[0.84] tracking-[-0.065em] text-brand-navy">
            Supply for<br />the cut.<br /><span className="text-brand-blue">Finish for<br />the craft.</span>
          </h1>
          <p className="mt-7 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">Pro-grade blades, abrasives, adhesives, sinks, and shop essentials—stocked locally and ready when your crew is.</p>
          <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link href="#catalog" className="inline-flex min-h-13 items-center gap-8 bg-brand-gold px-6 py-4 text-xs font-black uppercase tracking-wide text-white shadow-[7px_7px_0_#13212c] transition hover:-translate-y-0.5 hover:bg-[#b94721]">Shop the catalog <span>↗</span></Link>
            <Link href="#pro" className="border-b border-brand-navy pb-1 text-xs font-black text-brand-navy hover:text-brand-gold">Open a pro account →</Link>
          </div>
          <dl className="mt-14 grid grid-cols-3 border-t border-slate-300 pt-5">
            <div><dt className="font-display text-sm font-black uppercase">2 hr</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">Typical pickup prep</dd></div>
            <div className="border-l border-slate-300 pl-4"><dt className="font-display text-sm font-black uppercase">Local</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">Auburn, Washington</dd></div>
            <div className="border-l border-slate-300 pl-4"><dt className="font-display text-sm font-black uppercase">Real help</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">People who know the trade</dd></div>
          </dl>
        </div>

        <div className="relative min-h-[440px] p-4 pb-14 sm:p-8 sm:pb-16 lg:py-10 lg:pl-12 lg:pr-0">
          <div className="absolute inset-x-8 bottom-20 top-16 translate-x-3 translate-y-3 border border-slate-400/60 lg:right-[-24px]" />
          <div className="relative h-full min-h-[390px] overflow-hidden bg-slate-200 shadow-[0_22px_60px_rgba(19,33,44,0.16)] sm:min-h-[500px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/proposal/stone-shop-still-life.png" alt="Stone fabrication tools, polishing pads, gloves, and surface samples" className="h-full w-full object-cover object-[67%_center]" />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/20 via-transparent to-transparent" />
          </div>
          <div className="absolute bottom-5 right-2 flex items-center gap-3 border-t-[3px] border-brand-gold bg-white px-5 py-4 shadow-xl sm:right-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">✓</span>
            <p className="text-[10px] text-slate-500"><b className="block text-xs text-brand-navy">Pickup-ready stock</b>Live availability on every item</p>
          </div>
        </div>
      </div>
    </section>
  );
}
