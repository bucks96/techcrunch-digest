import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TechCrunch Daily Digest",
  description:
    "AI-powered daily briefing of TechCrunch — summaries, concept explanations, and story arcs for tech professionals.",
  openGraph: {
    title: "TechCrunch Daily Digest",
    description: "Your daily AI-curated TechCrunch briefing.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
