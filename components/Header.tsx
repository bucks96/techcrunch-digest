import { formatDate } from "@/lib/utils";

interface Props {
  date: string;
  articleCount: number;
  generatedAt: string;
}

export function Header({ date, articleCount, generatedAt }: Props) {
  const generated = new Date(generatedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {/* Green dot — TechCrunch-inspired accent */}
              <span className="inline-block h-3 w-3 rounded-full bg-brand-600" />
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Daily Digest
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              TechCrunch · {formatDate(date)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {articleCount} article{articleCount !== 1 ? "s" : ""} · AI-curated briefing for
              tech &amp; finance professionals · updated {generated}
            </p>
          </div>

          {/* Source badge */}
          <a
            href="https://techcrunch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 sm:flex"
          >
            <span>techcrunch.com</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
