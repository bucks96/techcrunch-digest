import { redirect } from "next/navigation";
import { getIndex } from "@/lib/digest";

export default function Home() {
  const index = getIndex();

  if (!index || !index.latest) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-5xl">📰</div>
        <h1 className="text-2xl font-bold text-slate-900">TechCrunch Daily Digest</h1>
        <p className="max-w-md text-slate-500">
          No digest available yet. The first issue will appear after the GitHub
          Actions workflow runs for the first time.
        </p>
        <p className="text-sm text-slate-400">
          Trigger it manually from the{" "}
          <strong>Actions</strong> tab in your GitHub repository.
        </p>
      </main>
    );
  }

  redirect(`/${index.latest}`);
}
