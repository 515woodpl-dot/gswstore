import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: `The story and working principles behind ${BRAND.name}.`,
};

export default function AboutPage() {
  return (
    <div className="bg-[#fbfaf7]">
      <section className="sps-grid-texture border-b border-slate-300">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-28">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Our story</p>
            <h1 className="font-display mt-4 text-[clamp(4rem,8vw,7.5rem)] font-black uppercase leading-[0.82] tracking-[-0.065em] text-brand-navy">Built close<br />to the work.</h1>
          </div>
          <div className="self-end border-l-[3px] border-brand-gold pl-7">
            <p className="max-w-2xl text-xl font-semibold leading-8 text-brand-blue sm:text-2xl">Stone Product Supply grew from a simple idea: local fabricators should be able to get dependable materials, practical advice, and get back to the job without losing half a day.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24 lg:px-8 lg:py-28">
        <div>
          <p className="font-display text-5xl font-black uppercase leading-none tracking-[-0.05em] text-brand-gold">The counter came first.</p>
        </div>
        <div className="space-y-6 text-base leading-8 text-slate-600">
          <p>What began as a small supply counter became a steady stop for crews across the region. Customers came in looking for the right blade, a better polishing sequence, or an adhesive they could trust under pressure. The conversations were practical, and the answers had to be useful.</p>
          <p>As the shop grew, the assortment grew with it—but the approach stayed the same. We focus on products that earn their place on a truck or in a fabrication shop, keep core items within reach, and help customers make a confident choice before they leave.</p>
          <p>The online store is the next version of that counter. It shows what is currently available, makes repeat orders faster, and lets the team prepare purchases before customers arrive in Auburn.</p>
        </div>
      </section>

      <section className="bg-brand-navy py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">How we work</p>
          <h2 className="font-display mt-3 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] sm:text-6xl">Straight answers. Useful stock. Local pickup.</h2>
          <div className="mt-12 grid border border-white/15 sm:grid-cols-3">
            <article className="p-7 sm:border-r sm:border-white/15"><span className="font-display text-[10px] font-black text-brand-gold">01</span><h3 className="font-display mt-12 text-2xl font-black uppercase">Choose with confidence</h3><p className="mt-3 text-xs leading-6 text-white/55">Clear product details and help from people familiar with the work.</p></article>
            <article className="border-t border-white/15 p-7 sm:border-r sm:border-t-0"><span className="font-display text-[10px] font-black text-brand-gold">02</span><h3 className="font-display mt-12 text-2xl font-black uppercase">See current stock</h3><p className="mt-3 text-xs leading-6 text-white/55">Inventory information that helps crews plan before making the drive.</p></article>
            <article className="border-t border-white/15 p-7 sm:border-t-0"><span className="font-display text-[10px] font-black text-brand-gold">03</span><h3 className="font-display mt-12 text-2xl font-black uppercase">Pick up and go</h3><p className="mt-3 text-xs leading-6 text-white/55">Orders prepared at the Auburn counter for a faster stop.</p></article>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Come see us</p><h2 className="font-display mt-3 text-4xl font-black uppercase tracking-[-0.05em] text-brand-navy">{BRAND.address}</h2><p className="mt-4 text-sm text-slate-600">Questions before you make the trip? Call {BRAND.phone}.</p></div>
        <Link href="/#catalog" className="inline-flex bg-brand-gold px-6 py-4 text-xs font-black uppercase tracking-wide text-white shadow-[6px_6px_0_#13212c]">Shop current inventory →</Link>
      </section>
    </div>
  );
}
