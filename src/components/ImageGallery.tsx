"use client";

import { useState } from "react";

const PLACEHOLDER = "/proposal/stone-shop-still-life.png";

export default function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const gallery = images.length > 0 ? images : [PLACEHOLDER];
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Main image */}
      <div className="group relative aspect-[4/3] overflow-hidden border border-slate-300 bg-[#e5e1da] shadow-[0_22px_55px_rgba(19,33,44,0.12)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gallery[active]} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
      </div>

      {/* Thumbnails */}
      {gallery.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {gallery.map((src, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`aspect-square overflow-hidden border transition ${i === active ? "border-brand-gold" : "border-slate-300 hover:border-brand-blue"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${name} ${i + 1}`} className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
