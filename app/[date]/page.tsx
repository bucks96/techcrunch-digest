import { notFound } from "next/navigation";
import { getDigest, getIndex } from "@/lib/digest";
import { adjacentDates } from "@/lib/utils";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";
import { DateNav } from "@/components/DateNav";

interface Props {
  params: { date: string };
}

export async function generateStaticParams() {
  const index = getIndex();
  if (!index) return [];
  return index.dates.map((date) => ({ date }));
}

export default function DigestPage({ params }: Props) {
  const { date } = params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const digest = getDigest(date);
  if (!digest) notFound();

  const index = getIndex();
  const nav   = index ? adjacentDates(index.dates, date) : { prev: null, next: null };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header date={date} articleCount={digest.article_count} generatedAt={digest.generated_at} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Date navigation */}
        <DateNav currentDate={date} prev={nav.prev} next={nav.next} allDates={index?.dates ?? []} />

        {/* Article list */}
        <div className="mt-8 space-y-6">
          {digest.articles.map((article, idx) => (
            <ArticleCard key={article.id} article={article} index={idx + 1} />
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-200 py-8 text-center text-xs text-slate-400">
          <p>
            Powered by{" "}
            <span className="font-medium text-slate-500">Claude claude-sonnet-4-6</span> · Source:{" "}
            <a
              href="https://techcrunch.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600"
            >
              TechCrunch RSS
            </a>{" "}
            · Generated{" "}
            {new Date(digest.generated_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZoneName: "short",
            })}
          </p>
        </footer>
      </main>
    </div>
  );
}
