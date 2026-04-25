"use client";

import { useState } from "react";
import type { Article, Concept, RelatedArticle, CompanyIntel } from "@/lib/types";

interface Props {
  article: Article;
  index: number;
}

export function ArticleCard({ article, index }: Props) {
  const { analysis } = article;

  const [openConcept, setOpenConcept] = useState<number | null>(null);
  const [showRelated, setShowRelated] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(
    analysis.company_intel ?? null
  );
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intelError, setIntelError] = useState(false);

  const hasConcepts = (analysis.concepts?.length ?? 0) > 0;
  const hasRelated = (analysis.related_articles?.length ?? 0) > 0;

  async function handleCompanyToggle() {
    if (companyIntel) {
      setShowCompany((v) => !v);
      return;
    }
    if (loadingIntel) return;
    setLoadingIntel(true);
    setIntelError(false);
    try {
      const res = await fetch("/api/company-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          content: article.content?.slice(0, 2500) ?? "",
          author: article.author ?? "",
        }),
      });
      if (!res.ok) throw new Error("non-ok");
      const data: CompanyIntel = await res.json();
      setCompanyIntel(data);
      setShowCompany(true);
    } catch {
      setIntelError(true);
    } finally {
      setLoadingIntel(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* ── Top meta bar ── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
        <span className="text-[10px] font-bold tabular-nums tracking-[0.18em] text-slate-400">
          #{String(index).padStart(2, "0")}
        </span>
        <div className="flex min-w-0 items-center gap-3">
          {article.author && (
            <span className="max-w-[160px] truncate text-[11px] text-slate-400">
              {article.author}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-slate-400">
            {new Date(article.published_date).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })}{" "}
            UTC
          </span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Read
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* ── Headline ── */}
        <h2 className="text-[1.05rem] font-bold leading-snug text-slate-900 sm:text-lg">
          {analysis.headline}
        </h2>

        {/* ── Original title ── */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-[11px] leading-relaxed text-slate-400 transition-colors hover:text-slate-600 hover:underline"
        >
          {article.title}
        </a>

        {/* ── Summary ── */}
        <p className="mt-3.5 text-sm leading-relaxed text-slate-700">
          {analysis.summary}
        </p>

        {/* ── Section toggle pills ── */}
        <div className="mt-4 flex flex-wrap gap-2">
          {hasConcepts && (
            <SectionPill
              active={showConcepts}
              onClick={() => setShowConcepts((v) => !v)}
              color="green"
              label="Key Concepts"
              count={analysis.concepts.length}
            />
          )}
          {hasRelated && (
            <SectionPill
              active={showRelated}
              onClick={() => setShowRelated((v) => !v)}
              color="amber"
              label="Story Arc"
              count={analysis.related_articles.length}
            />
          )}
          <SectionPill
            active={showCompany && !!companyIntel}
            loading={loadingIntel}
            onClick={handleCompanyToggle}
            color="blue"
            label="Company Profile"
          />
        </div>

        {/* ── Key Concepts (expanded) ── */}
        {showConcepts && hasConcepts && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {analysis.concepts.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setOpenConcept(openConcept === i ? null : i)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    openConcept === i
                      ? "border-brand-300 bg-brand-100 text-brand-800"
                      : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                  }`}
                >
                  {c.term}
                  <span className="ml-1 text-brand-400">
                    {openConcept === i ? "▲" : "▼"}
                  </span>
                </button>
              ))}
            </div>
            {openConcept !== null && (
              <ConceptDetail concept={analysis.concepts[openConcept]} />
            )}
          </div>
        )}

        {/* ── Story Arc (expanded) ── */}
        {showRelated && hasRelated && (
          <div className="mt-4 space-y-3">
            {analysis.related_articles.map((r, i) => (
              <RelatedArticleItem key={i} related={r} />
            ))}
          </div>
        )}

        {/* ── Company Profile (expanded) ── */}
        {showCompany && companyIntel && companyIntel.company_name && (
          <CompanyIntelPanel intel={companyIntel} />
        )}
        {showCompany && companyIntel && !companyIntel.company_name && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            No specific company identified for this article.
          </div>
        )}
        {intelError && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
            Could not load company profile. Ensure ANTHROPIC_API_KEY is set.
          </div>
        )}
      </div>
    </article>
  );
}

// ── Section pill toggle ────────────────────────────────────────────────────────

const PILL_COLORS = {
  green: {
    base: "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
    active: "border-brand-300 bg-brand-100 text-brand-800",
  },
  amber: {
    base: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    active: "border-amber-300 bg-amber-100 text-amber-800",
  },
  blue: {
    base: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    active: "border-blue-300 bg-blue-100 text-blue-800",
  },
} as const;

function SectionPill({
  active,
  loading,
  onClick,
  color,
  label,
  count,
}: {
  active: boolean;
  loading?: boolean;
  onClick: () => void;
  color: keyof typeof PILL_COLORS;
  label: string;
  count?: number;
}) {
  const c = PILL_COLORS[color];
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all disabled:opacity-60 ${
        active ? c.active : c.base
      }`}
    >
      <span>{label}</span>
      {count != null && (
        <span className="rounded-full bg-white/70 px-1.5 font-bold">{count}</span>
      )}
      {loading ? (
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg
          className={`h-3 w-3 transition-transform duration-200 ${active ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </button>
  );
}

// ── Concept detail ─────────────────────────────────────────────────────────────

function ConceptDetail({ concept }: { concept: Concept }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-700">
        {concept.term}
      </p>
      <p className="text-sm leading-relaxed text-slate-700">{concept.explanation}</p>
      {concept.context && (
        <>
          <div className="my-3 border-t border-brand-200" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            In this article
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{concept.context}</p>
        </>
      )}
    </div>
  );
}

// ── Related article item ───────────────────────────────────────────────────────

function RelatedArticleItem({ related }: { related: RelatedArticle }) {
  const date = related.published_date?.slice(0, 10) ?? "";
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-amber-500">↩</span>
        <div className="min-w-0">
          <a
            href={related.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-slate-800 hover:underline"
          >
            {related.title}
          </a>
          {date && <span className="ml-2 text-xs text-slate-400">{date}</span>}
        </div>
      </div>
      {related.relationship && (
        <p className="mt-2 text-xs italic text-amber-700">{related.relationship}</p>
      )}
      {related.update_summary && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What changed
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{related.update_summary}</p>
        </div>
      )}
      {related.future_outlook && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What to watch
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{related.future_outlook}</p>
        </div>
      )}
    </div>
  );
}

// ── Company intel panel ────────────────────────────────────────────────────────

function CompanyIntelPanel({ intel }: { intel: CompanyIntel }) {
  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      {/* Company header row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-900">{intel.company_name}</span>

        {intel.is_public && intel.ticker && (
          <span className="rounded border border-blue-200 bg-white px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
            {intel.ticker}
            {intel.exchange && (
              <span className="font-normal text-blue-400"> · {intel.exchange}</span>
            )}
          </span>
        )}

        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            intel.is_public
              ? "bg-brand-100 text-brand-700"
              : "bg-purple-100 text-purple-700"
          }`}
        >
          {intel.is_public ? "Public" : "Private"}
        </span>

        {intel.founded_year && (
          <span className="text-xs text-slate-500">Est. {intel.founded_year}</span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-slate-700">{intel.what_it_does}</p>

      {/* Financial stats */}
      {(intel.revenue || intel.net_income) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {intel.revenue && (
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Revenue
              </p>
              <p className="text-sm font-bold text-slate-800">{intel.revenue}</p>
            </div>
          )}
          {intel.net_income && (
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Net Income
              </p>
              <p className="text-sm font-bold text-slate-800">{intel.net_income}</p>
            </div>
          )}
        </div>
      )}

      {/* Funding (private companies) */}
      {!intel.is_public && (intel.total_funding || (intel.key_funding_rounds?.length ?? 0) > 0) && (
        <div className="mt-3">
          {intel.total_funding && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Total raised:</span>
              <span className="text-xs font-bold text-purple-700">{intel.total_funding}</span>
            </div>
          )}
          {(intel.key_funding_rounds?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              {intel.key_funding_rounds.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                  <span className="font-semibold">{r.round}</span>
                  <span className="text-slate-400">{r.year}</span>
                  <span className="text-slate-700">{r.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] italic text-slate-400">
        Financial data from AI training knowledge · may not reflect latest filings
      </p>
    </div>
  );
}
