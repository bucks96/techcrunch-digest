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

  const [y, m, d] = date.split("-").map(Number);
  const dayOfWeek = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
  });

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* thin green accent stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* badge row */}
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Daily Digest
              </span>
              <span className="text-[11px] text-slate-400">{dayOfWeek}</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              TechCrunch{" "}
              <span className="font-normal text-slate-300">·</span>{" "}
              {formatDate(date)}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {articleCount} article{articleCount !== 1 ? "s" : ""} ·
              AI-curated for tech &amp; finance professionals · updated{" "}
              {generated}
            </p>
          </div>

          <a
            href="https://techcrunch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:flex"
          >
            techcrunch.com
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
