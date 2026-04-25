#!/usr/bin/env python3
"""
TechCrunch Daily Digest — Web Dashboard Edition
================================================
Run daily via GitHub Actions.  For each article published yesterday:
  1. Generates a rewritten headline + <100-word summary
  2. Explains 2-5 non-obvious financial / technical concepts (5-yr professional level)
  3. Detects related articles from the past 180 days and summarises the arc

Writes to:
  public/data/digest-YYYY-MM-DD.json   – per-day data consumed by the Next.js dashboard
  public/data/index.json               – list of available dates (for navigation)
  data/articles.db                     – rolling SQLite store (committed to repo)

Optionally sends an HTML email if SMTP env vars are present.
"""

import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anthropic
import feedparser

# ── Config ────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
EMAIL_FROM        = os.environ.get("EMAIL_FROM", "")
EMAIL_TO          = os.environ.get("EMAIL_TO", "")
SMTP_HOST         = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT         = int(os.environ.get("SMTP_PORT") or "587")
SMTP_USER         = os.environ.get("SMTP_USER", "")
SMTP_PASS         = os.environ.get("SMTP_PASS", "")

BASE_DIR  = Path(__file__).parent
DB_PATH   = BASE_DIR / "data" / "articles.db"
DATA_DIR  = BASE_DIR / "public" / "data"
FEED_URL  = "https://techcrunch.com/feed/"
MODEL     = "claude-sonnet-4-6"

# ── Database ──────────────────────────────────────────────────────────────────

def init_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id             TEXT PRIMARY KEY,
            title          TEXT NOT NULL,
            url            TEXT NOT NULL,
            published_date TEXT NOT NULL,
            author         TEXT,
            content        TEXT,
            summary        TEXT,
            analysis       TEXT,
            fetched_date   TEXT NOT NULL
        )
    """)
    # Migrate older DBs that may be missing columns
    for col, typedef in [("author", "TEXT"), ("analysis", "TEXT")]:
        try:
            conn.execute(f"ALTER TABLE articles ADD COLUMN {col} {typedef}")
        except sqlite3.OperationalError:
            pass
    conn.commit()
    return conn


def store_articles(conn: sqlite3.Connection, articles: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    new = []
    for a in articles:
        cur = conn.execute(
            "INSERT OR IGNORE INTO articles "
            "(id, title, url, published_date, author, content, fetched_date) "
            "VALUES (?,?,?,?,?,?,?)",
            (a["id"], a["title"], a["url"], a["published_date"],
             a.get("author", ""), a.get("content", ""), now),
        )
        if cur.rowcount:
            new.append(a)
    conn.commit()
    return new


def get_yesterdays_articles(conn: sqlite3.Connection) -> list[dict]:
    """Return articles whose published_date falls on UTC yesterday."""
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    rows = conn.execute(
        "SELECT id, title, url, published_date, author, content FROM articles "
        "WHERE published_date >= ? AND published_date < ? "
        "ORDER BY published_date DESC",
        (yesterday, datetime.now(timezone.utc).date().isoformat()),
    ).fetchall()
    return [
        dict(zip(("id", "title", "url", "published_date", "author", "content"), r))
        for r in rows
    ]


def get_todays_articles(conn: sqlite3.Connection) -> list[dict]:
    """Return articles fetched today (fallback if yesterday had none)."""
    today = datetime.now(timezone.utc).date().isoformat()
    rows = conn.execute(
        "SELECT id, title, url, published_date, author, content FROM articles "
        "WHERE fetched_date >= ? ORDER BY published_date DESC",
        (today,),
    ).fetchall()
    return [
        dict(zip(("id", "title", "url", "published_date", "author", "content"), r))
        for r in rows
    ]


def get_historical_articles(conn: sqlite3.Connection, exclude_ids: list[str], days: int = 180) -> list[dict]:
    """Return older articles for related-article detection."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    today  = datetime.now(timezone.utc).date().isoformat()
    placeholders = ",".join("?" * len(exclude_ids)) if exclude_ids else "'__never__'"
    query = (
        "SELECT id, title, url, published_date, summary FROM articles "
        f"WHERE published_date < ? AND published_date >= ? "
        f"{'AND id NOT IN (' + placeholders + ')' if exclude_ids else ''} "
        "ORDER BY published_date DESC LIMIT 2000"
    )
    params = [today, cutoff] + (exclude_ids if exclude_ids else [])
    rows = conn.execute(query, params).fetchall()
    return [
        dict(zip(("id", "title", "url", "published_date", "summary"), r))
        for r in rows
    ]


def save_analysis(conn: sqlite3.Connection, article_id: str, analysis: dict):
    conn.execute(
        "UPDATE articles SET analysis = ?, summary = ? WHERE id = ?",
        (json.dumps(analysis), analysis.get("summary", ""), article_id),
    )
    conn.commit()


# ── Feed ──────────────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;",  "&", text)
    text = re.sub(r"&lt;",   "<", text)
    text = re.sub(r"&gt;",   ">", text)
    text = re.sub(r"&quot;", '"', text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_feed() -> list[dict]:
    feed = feedparser.parse(FEED_URL)
    articles = []
    for entry in feed.entries:
        # Prefer full content:encoded over summary
        content = ""
        if hasattr(entry, "content") and entry.content:
            content = entry.content[0].get("value", "")
        if not content:
            content = entry.get("summary", "")
        content = _strip_html(content)[:3000]

        author = ""
        if hasattr(entry, "author"):
            author = entry.author
        elif hasattr(entry, "authors") and entry.authors:
            author = entry.authors[0].get("name", "")

        published = entry.get("published", datetime.now(timezone.utc).isoformat())

        articles.append({
            "id":             entry.get("id", entry.link),
            "title":          entry.title,
            "url":            entry.link,
            "published_date": published,
            "author":         author,
            "content":        content,
        })
    return articles


# ── Claude AI ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a senior technology and finance analyst writing a daily digest for professionals \
with 5+ years of industry experience. Be concise, precise, and add real analytical value. \
Never pad responses. Return only the requested JSON — no markdown fences, no commentary."""

ARTICLE_PROMPT = """\
Analyse the following TechCrunch article and return a single JSON object with this EXACT structure:

{{
  "headline": "A sharp rewritten headline — capture the *why it matters*, not just the what",
  "summary": "Strictly under 100 words. Who did what, key numbers/metrics, and why this is significant. \
Professional, direct, no fluff.",
  "concepts": [
    {{
      "term": "The exact term as it appears (or should be understood)",
      "explanation": "2-3 sentences for a seasoned professional. Skip basics. \
Focus on mechanism, nuance, risk, or why this specific variant matters.",
      "context": "1-2 sentences: how this concept applies specifically in this article."
    }}
  ],
  "related_articles": [
    {{
      "article_id": "EXACT id string from the HISTORICAL LIST below",
      "title": "Title of that historical article",
      "published_date": "YYYY-MM-DD of that article",
      "url": "URL of that article",
      "relationship": "One sentence: what connects these two stories",
      "update_summary": "2-3 sentences: how today's news changes, advances, or contradicts the earlier situation",
      "future_outlook": "1-2 sentences: what to watch next given this development arc"
    }}
  ],
  "company_intel": {{
    "company_name": "Primary company this article is about (null if no specific company)",
    "what_it_does": "2-3 sentences describing core business model and product/service",
    "founded_year": 2003,
    "is_public": true,
    "ticker": "TSLA",
    "exchange": "NASDAQ",
    "total_funding": null,
    "key_funding_rounds": [],
    "revenue": "$97.7B (FY2024)",
    "net_income": "$7.1B (FY2024)"
  }}
}}

STRICT RULES:
1. summary: count words — MUST be under 100.
2. concepts: include 2–5 entries. Only genuinely non-obvious terms for a 5-year professional:
   INCLUDE → specific protocols (QUIC, WebAssembly, RISC-V), financial instruments \
(convertible note, secondary buyout, revenue-based financing), regulatory frameworks \
(GDPR Article 22, Section 230, CFPB supervision, HSR Act), niche architectures, \
esoteric industry terminology.
   SKIP    → "startup", "IPO", "Series A/B/C" (unless specific mechanics matter), \
"API", "cloud computing", "machine learning" (unless the exact variant matters).
3. related_articles: only genuine connections — same company, same product line, same \
ongoing regulatory thread, or the same macro story arc. Use [] if nothing is genuinely related. \
Copy the article_id, title, published_date, and url EXACTLY from the historical list.
4. company_intel: use your training knowledge. For public companies set total_funding=null and \
key_funding_rounds=[]. For private/startup companies include funding rounds if known. \
Use null for any values you are not confident about. Prefix uncertain figures with "~". \
If the article covers no specific company (policy/industry piece), set company_name=null.
5. Return ONLY the raw JSON object. No markdown code fences. No extra text.

ARTICLE TO ANALYSE:
Title:     {title}
Author:    {author}
Published: {published_date}
Content:   {content}

HISTORICAL ARTICLES — past 180 days (copy ids/urls/dates exactly if referencing):
{historical_list}
"""


def _format_historical(historical: list[dict]) -> str:
    if not historical:
        return "(none yet — database is still building up)"
    lines = []
    for a in historical[:250]:  # cap tokens; ~250 lines ≈ ~7k tokens
        snippet = (a.get("summary") or "")[:100].strip()
        snippet_part = f' | "{snippet}..."' if snippet else ""
        lines.append(
            f'id: "{a["id"]}" | date: {a["published_date"][:10]} '
            f'| url: {a["url"]} | title: {a["title"]}{snippet_part}'
        )
    return "\n".join(lines)


def _parse_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown fences if model added them anyway
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Last resort: pull out the outermost {...}
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"No JSON found in response: {text[:300]}")


def analyze_article(
    client: anthropic.Anthropic,
    article: dict,
    historical: list[dict],
) -> dict:
    historical_list = _format_historical(historical)
    prompt = ARTICLE_PROMPT.format(
        title=article["title"],
        author=article.get("author") or "Unknown",
        published_date=article["published_date"][:10],
        content=(article.get("content") or "")[:2500],
        historical_list=historical_list,
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=3000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    analysis = _parse_json(raw)

    # Ensure required keys with safe defaults
    analysis.setdefault("headline", article["title"])
    analysis.setdefault("summary", "")
    analysis.setdefault("concepts", [])
    analysis.setdefault("related_articles", [])
    analysis.setdefault("company_intel", None)

    return analysis


# ── JSON output ───────────────────────────────────────────────────────────────

def write_digest_json(date_str: str, articles: list[dict]):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    digest = {
        "date":          date_str,
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "article_count": len(articles),
        "articles":      articles,
    }

    out_path = DATA_DIR / f"digest-{date_str}.json"
    out_path.write_text(json.dumps(digest, indent=2, ensure_ascii=False))
    print(f"  Wrote {out_path}")

    # Update index.json (navigation list for the frontend)
    index_path = DATA_DIR / "index.json"
    try:
        index = json.loads(index_path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        index = {"dates": [], "latest": ""}

    if date_str not in index["dates"]:
        index["dates"].append(date_str)
    index["dates"].sort(reverse=True)
    index["latest"] = index["dates"][0]
    index_path.write_text(json.dumps(index, indent=2))
    print(f"  Updated {index_path}")


# ── Optional email digest ─────────────────────────────────────────────────────

def build_email_html(articles: list[dict], date_str: str) -> str:
    article_blocks = []
    for i, a in enumerate(articles, 1):
        analysis = a.get("analysis", {})
        headline = analysis.get("headline", a["title"])
        summary  = analysis.get("summary", "")

        concepts_html = ""
        for c in analysis.get("concepts", [])[:3]:
            concepts_html += (
                f'<div style="margin:6px 0; padding:8px 10px; background:#f0f7f4; '
                f'border-left:3px solid #16a34a; border-radius:4px; font-size:12px;">'
                f'<strong>{c["term"]}</strong>: {c["explanation"]}'
                f'</div>'
            )

        related_html = ""
        for r in analysis.get("related_articles", [])[:2]:
            related_html += (
                f'<div style="margin:4px 0; font-size:12px; color:#555;">'
                f'🔗 <a href="{r.get("url","#")}">{r.get("title","Related article")}</a> '
                f'({r.get("published_date","")[:10]}) — {r.get("update_summary","")}'
                f'</div>'
            )

        article_blocks.append(f"""
          <div style="margin-bottom:24px; padding:16px 18px; background:#f8f9fa;
               border-radius:8px; border-left:4px solid #16a34a;">
            <div style="font-size:11px; color:#888; margin-bottom:6px;">#{i}</div>
            <h3 style="margin:0 0 4px; font-size:15px; color:#111;">
              <a href="{a['url']}" style="color:#111; text-decoration:none;">{headline}</a>
            </h3>
            <div style="font-size:11px; color:#999; margin-bottom:10px;">
              {a.get('author','')} · {a['published_date'][:10]}
            </div>
            <p style="margin:0 0 10px; font-size:13px; color:#444; line-height:1.6;">{summary}</p>
            {concepts_html}
            {related_html}
          </div>""")

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  max-width:680px;margin:0 auto;padding:24px;color:#222;background:#fff;}}</style>
</head>
<body>
  <div style="background:#16a34a;color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22px;">TechCrunch Daily Digest</h1>
    <p style="margin:4px 0 0;opacity:.85;">{date_str} · {len(articles)} articles</p>
  </div>
  {"".join(article_blocks)}
  <div style="margin-top:32px;font-size:11px;color:#bbb;border-top:1px solid #eee;padding-top:14px;">
    Powered by Claude {MODEL} · TechCrunch RSS ·
    Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
  </div>
</body></html>"""


def send_email(html: str, date_str: str):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"TechCrunch Digest — {date_str}"
    msg["From"]    = EMAIL_FROM
    msg["To"]      = EMAIL_TO
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())
    print(f"  Email sent → {EMAIL_TO}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"[{ts}] TechCrunch digest starting…")

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY is not set.")
        sys.exit(1)

    conn   = init_db()
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # ── 1. Fetch feed ────────────────────────────────────────────────────────
    print("  Fetching TechCrunch RSS…")
    all_articles = fetch_feed()
    new_articles = store_articles(conn, all_articles)
    print(f"  {len(new_articles)} new articles stored (feed: {len(all_articles)})")

    # ── 2. Pick articles to digest (yesterday's, or today's as fallback) ─────
    target_articles = get_yesterdays_articles(conn)
    if not target_articles:
        print("  No articles from yesterday — falling back to today's fetched articles")
        target_articles = get_todays_articles(conn)

    if not target_articles:
        print("  Nothing to digest — exiting.")
        conn.close()
        return

    date_str = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    print(f"  {len(target_articles)} articles to analyse for {date_str}")

    # ── 3. Load historical articles for relationship detection ───────────────
    target_ids   = [a["id"] for a in target_articles]
    historical   = get_historical_articles(conn, exclude_ids=target_ids)
    print(f"  {len(historical)} historical articles loaded (180-day window)")

    # ── 4. Per-article deep analysis ─────────────────────────────────────────
    print("  Analysing articles with Claude…")
    enriched = []
    for i, article in enumerate(target_articles, 1):
        print(f"    [{i}/{len(target_articles)}] {article['title'][:70]}…")
        try:
            analysis = analyze_article(client, article, historical)
            save_analysis(conn, article["id"], analysis)
            enriched.append({**article, "analysis": analysis})
        except Exception as exc:
            print(f"      WARNING: analysis failed — {exc}")
            enriched.append({
                **article,
                "analysis": {
                    "headline":         article["title"],
                    "summary":          article.get("content", "")[:200],
                    "concepts":         [],
                    "related_articles": [],
                },
            })
        # Small delay to respect API rate limits
        if i < len(target_articles):
            time.sleep(1)

    conn.close()

    # ── 5. Write JSON for dashboard ──────────────────────────────────────────
    write_digest_json(date_str, enriched)

    # ── 6. Optional email ────────────────────────────────────────────────────
    if EMAIL_FROM and EMAIL_TO and SMTP_PASS:
        print("  Sending email digest…")
        html = build_email_html(enriched, date_str)
        send_email(html, date_str)
    else:
        print("  (Email skipped — SMTP vars not set)")

    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}] Done. ✓")


if __name__ == "__main__":
    main()
