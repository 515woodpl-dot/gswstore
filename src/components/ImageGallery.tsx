"use client";

import { useState } from "react";

const PLACEHOLDER = "https://placehold.co/720x540/1e3a5f/ffffff?text=Golden+Stone+Tools";

export default function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const gallery = images.length > 0 ? images : [PLACEHOLDER];
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gallery[active]} alt={name} className="h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
      </div>

      {/* Thumbnails */}
      {gallery.length > 1 && (
        <div className="grid grid-cols-5 gap-3">
          {gallery.map((src, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`aspect-square overflow-hidden rounded-xl border-2 transition ${i === active ? "border-brand-navy" : "border-slate-200 hover:border-slate-300"}`}>
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
