"use client";

import { useState, type ReactNode } from "react";

interface Section { title: string; content: ReactNode; }

export default function Accordion({ sections, defaultOpen = 0 }: { sections: Section[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <div className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
      {sections.map((s, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-bold uppercase tracking-wide text-slate-900">{s.title}</span>
              <svg className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isOpen && <div className="px-5 pb-5 text-sm leading-7 text-slate-600">{s.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
