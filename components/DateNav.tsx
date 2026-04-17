"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

interface Props {
  currentDate: string;
  prev: string | null; // older date
  next: string | null; // newer date
  allDates: string[];
}

export function DateNav({ currentDate, prev, next, allDates }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3">
      {/* ← Older */}
      {prev ? (
        <Link
          href={`/${prev}`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{formatDate(prev)}</span>
          <span className="sm:hidden">Older</span>
        </Link>
      ) : (
        <div className="w-24" />
      )}

      {/* Date picker dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(currentDate)}
          <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-1/2 top-full z-20 mt-1 max-h-60 w-52 -translate-x-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {allDates.map((d) => (
                <Link
                  key={d}
                  href={`/${d}`}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    d === currentDate
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-slate-700"
                  }`}
                >
                  {formatDate(d)}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* → Newer */}
      {next ? (
        <Link
          href={`/${next}`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <span className="hidden sm:inline">{formatDate(next)}</span>
          <span className="sm:hidden">Newer</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <div className="w-24" />
      )}
    </div>
  );
}
