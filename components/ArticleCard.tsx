"use client";

import { useState } from "react";
import type { Article, Concept, RelatedArticle } from "@/lib/types";

interface Props {
  article: Article;
  index: number;
}

export function ArticleCard({ article, index }: Props) {
  const { analysis } = article;
  const [openConcept, setOpenConcept]     = useState<number | null>(null);
  const [showRelated, setShowRelated]     = useState(false);
  const [showConcepts, setShowConcepts]   = useState(false);

  const hasConcepts = analysis.concepts?.length > 0;
  const hasRelated  = analysis.related_articles?.length > 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
        <span className="text-xs font-bold tabular-nums text-slate-400">
          #{String(index).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-3">
          {article.author && (
            <span className="text-xs text-slate-400">{article.author}</span>
          )}
          <span className="text-xs text-slate-400">
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
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            Read original
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* ── Headline ── */}
        <h2 className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">
          {analysis.headline}
        </h2>

        {/* ── Original title (smaller, link) ── */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-xs text-slate-400 hover:text-slate-600 hover:underline transition-colors"
        >
          {article.title}
        </a>

        {/* ── Summary ── */}
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {analysis.summary}
        </p>

        {/* ── Concepts section ── */}
        {hasConcepts && (
          <div className="mt-5">
            <button
              onClick={() => setShowConcepts(!showConcepts)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-slate-500">
                {showConcepts ? "−" : "+"}
              </span>
              Key Concepts
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                {analysis.concepts.length}
              </span>
            </button>

            {showConcepts && (
              <div className="mt-3 space-y-2">
                {/* Concept pills */}
                <div className="flex flex-wrap gap-2">
                  {analysis.concepts.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setOpenConcept(openConcept === i ? null : i)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        openConcept === i
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                      }`}
                    >
                      {c.term}
                      <span className="ml-1 opacity-60">{openConcept === i ? "▲" : "▼"}</span>
                    </button>
                  ))}
                </div>

                {/* Expanded concept */}
                {openConcept !== null && (
                  <ConceptDetail concept={analysis.concepts[openConcept]} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Related articles section ── */}
        {hasRelated && (
          <div className="mt-5">
            <button
              onClick={() => setShowRelated(!showRelated)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-100 text-amber-600">
                {showRelated ? "−" : "+"}
              </span>
              Story Arc
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                {analysis.related_articles.length} related
              </span>
            </button>

            {showRelated && (
              <div className="mt-3 space-y-3">
                {analysis.related_articles.map((r, i) => (
                  <RelatedArticleItem key={i} related={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

function RelatedArticleItem({ related }: { related: RelatedArticle }) {
  const date = related.published_date?.slice(0, 10) ?? "";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      {/* Previous article link */}
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
          {date && (
            <span className="ml-2 text-xs text-slate-400">{date}</span>
          )}
        </div>
      </div>

      {related.relationship && (
        <p className="mt-2 text-xs italic text-amber-700">{related.relationship}</p>
      )}

      {/* Update summary */}
      {related.update_summary && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What changed</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{related.update_summary}</p>
        </div>
      )}

      {/* Future outlook */}
      {related.future_outlook && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What to watch</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{related.future_outlook}</p>
        </div>
      )}
    </div>
  );
}
