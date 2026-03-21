#!/usr/bin/env python3
"""
TechCrunch Daily Digest
- Fetches TechCrunch RSS feed
- Stores articles in SQLite (rolling history, committed to repo)
- Generates AI summaries + trend analysis via Claude Opus 4.6
- Sends an HTML email digest
"""

import json
import os
import re
import smtplib
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import anthropic
import feedparser

# ---------------------------------------------------------------------------
# Configuration — all values come from environment variables (GitHub Secrets)
# ---------------------------------------------------------------------------
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
EMAIL_FROM        = os.environ.get("EMAIL_FROM", "")
EMAIL_TO          = os.environ.get("EMAIL_TO", "")
SMTP_HOST         = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT         = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER         = os.environ.get("SMTP_USER", "")
SMTP_PASS         = os.environ.get("SMTP_PASS", "")

BASE_DIR  = Path(__file__).parent
DB_PATH   = BASE_DIR / "data" / "articles.db"
FEED_URL  = "https://techcrunch.com/feed/"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def init_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id             TEXT PRIMARY KEY,
            title          TEXT NOT NULL,
            url            TEXT NOT NULL,
            published_date TEXT NOT NULL,
            content        TEXT,
            summary        TEXT,
            fetched_date   TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def store_articles(conn: sqlite3.Connection, articles: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    new = []
    for a in articles:
        cur = conn.execute(
            "INSERT OR IGNORE INTO articles "
            "(id, title, url, published_date, content, fetched_date) VALUES (?,?,?,?,?,?)",
            (a["id"], a["title"], a["url"], a["published_date"], a["content"], now),
        )
        if cur.rowcount:
            new.append(a)
    conn.commit()
    return new


def get_todays_articles(conn: sqlite3.Connection) -> list[dict]:
    today = datetime.now(timezone.utc).date().isoformat()
    rows = conn.execute(
        "SELECT id, title, url, published_date, content FROM articles "
        "WHERE fetched_date >= ? ORDER BY published_date DESC",
        (today,),
    ).fetchall()
    return [dict(zip(("id", "title", "url", "published_date", "content"), r)) for r in rows]


def get_historical_articles(conn: sqlite3.Connection, days: int = 365) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = conn.execute(
        "SELECT id, title, url, published_date, summary FROM articles "
        "WHERE fetched_date >= ? ORDER BY published_date DESC LIMIT 1000",
        (cutoff,),
    ).fetchall()
    return [dict(zip(("id", "title", "url", "published_date", "summary"), r)) for r in rows]


def save_summaries(conn: sqlite3.Connection, articles: list[dict], summaries: list[dict]):
    for art, summ in zip(articles, summaries):
        conn.execute(
            "UPDATE articles SET summary = ? WHERE id = ?",
            (summ.get("description", ""), art["id"]),
        )
    conn.commit()

# ---------------------------------------------------------------------------
# Feed
# ---------------------------------------------------------------------------

def fetch_feed() -> list[dict]:
    feed = feedparser.parse(FEED_URL)
    return [
        {
            "id":             entry.get("id", entry.link),
            "title":          entry.title,
            "url":            entry.link,
            "published_date": entry.get("published", datetime.now(timezone.utc).isoformat()),
            "content":        entry.get("summary", ""),
        }
        for entry in feed.entries
    ]

# ---------------------------------------------------------------------------
# Claude AI
# ---------------------------------------------------------------------------

def _extract_json_array(text: str) -> list:
    match = re.search(r"\[.*\]", text, re.DOTALL)
    return json.loads(match.group() if match else text)


def generate_summaries(client: anthropic.Anthropic, articles: list[dict]) -> list[dict]:
    batch = articles[:30]
    articles_text = "\n\n".join(
        f"Article {i+1}:\nTitle: {a['title']}\nURL: {a['url']}\nExcerpt: {a['content'][:600]}"
        for i, a in enumerate(batch)
    )
    prompt = f"""\
You are a tech journalist creating a daily digest. For EACH article below produce:
1. "title"       — the article headline (keep it or shorten it slightly)
2. "description" — a maximum of 3 lines explaining what the story is about and why it matters

Respond with a valid JSON array of objects with keys "title" and "description".
Output ONLY the JSON array — no other text.

Articles:
{articles_text}"""

    resp = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = next(b.text for b in resp.content if b.type == "text")
    return _extract_json_array(text)


def generate_insights(
    client: anthropic.Anthropic,
    today_articles: list[dict],
    historical_articles: list[dict],
) -> str:
    today_titles = "\n".join(f"- {a['title']}" for a in today_articles[:30])

    if historical_articles:
        hist_titles = "\n".join(
            f"- [{a['published_date'][:10]}] {a['title']}"
            for a in historical_articles[:300]
        )
        prompt = f"""\
You are a senior tech analyst with deep knowledge of industry trends.

TODAY'S NEWS:
{today_titles}

PAST YEAR'S HEADLINES (for context):
{hist_titles}

Provide a structured analysis with these three sections:

**Emerging Patterns**
2–3 major themes gaining momentum — connect today's stories to the past year's arc.

**Story Arcs**
2–3 specific ongoing narratives that today's news advances. Cite concrete past examples.

**Key Insight**
One sharp, forward-looking observation about where the tech industry is heading.

Be specific. Name article topics. Avoid vague generalisations."""
    else:
        prompt = f"""\
You are a senior tech analyst. Analyse today's tech news.

TODAY'S NEWS:
{today_titles}

Provide:

**Emerging Patterns**
2–3 major themes visible across today's stories.

**Key Developments**
The 2–3 most consequential stories and why they matter.

**Key Insight**
One sharp, forward-looking observation about where tech is heading."""

    resp = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    return next(b.text for b in resp.content if b.type == "text")

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

def build_html(
    today_articles: list[dict],
    summaries: list[dict],
    insights: str,
    date_str: str,
) -> str:
    article_blocks = []
    for art, summ in zip(today_articles, summaries):
        title = summ.get("title", art["title"])
        desc  = summ.get("description", "").replace("\n", " ")
        article_blocks.append(f"""
          <div class="article">
            <h3><a href="{art['url']}">{title}</a></h3>
            <p>{desc}</p>
          </div>""")

    articles_html = "\n".join(article_blocks)
    insights_html = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", insights)
    insights_html = insights_html.replace("\n", "<br>")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body     {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 680px; margin: 0 auto; padding: 24px; color: #222; background: #fff; }}
  h1       {{ color: #0f5dc7; border-bottom: 2px solid #0f5dc7; padding-bottom: 10px; }}
  h2       {{ color: #333; margin-top: 32px; font-size: 18px; }}
  .article {{ margin-bottom: 16px; padding: 14px 16px; background: #f7f8fa;
              border-radius: 8px; border-left: 3px solid #0f5dc7; }}
  .article h3  {{ margin: 0 0 6px; font-size: 15px; }}
  .article h3 a {{ color: #0f5dc7; text-decoration: none; }}
  .article h3 a:hover {{ text-decoration: underline; }}
  .article p   {{ margin: 0; font-size: 13px; color: #555; line-height: 1.55; }}
  .insights {{ background: #eaf3ff; padding: 18px 20px; border-radius: 8px;
               border-left: 4px solid #0f5dc7; font-size: 14px; line-height: 1.7; }}
  .footer   {{ margin-top: 32px; font-size: 11px; color: #aaa;
               border-top: 1px solid #eee; padding-top: 14px; }}
</style>
</head>
<body>
  <h1>TechCrunch Daily Digest &mdash; {date_str}</h1>
  <p style="color:#666; margin-top:-8px;">{len(today_articles)} articles</p>

  <h2>Today&rsquo;s Stories</h2>
  {articles_html}

  <h2>Trends &amp; Insights</h2>
  <div class="insights">{insights_html}</div>

  <div class="footer">
    Powered by Claude Opus 4.6 &bull; TechCrunch RSS &bull;
    Generated {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
  </div>
</body>
</html>"""


def send_email(html: str, date_str: str):
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

    print(f"  Email sent to {EMAIL_TO}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] TechCrunch digest starting…")

    missing = [v for v in ("ANTHROPIC_API_KEY", "EMAIL_FROM", "EMAIL_TO", "SMTP_PASS")
               if not os.environ.get(v)]
    if missing:
        print(f"ERROR: missing env vars: {', '.join(missing)}")
        sys.exit(1)

    conn = init_db()

    print("  Fetching TechCrunch RSS…")
    articles = fetch_feed()
    new = store_articles(conn, articles)
    print(f"  {len(new)} new articles stored (feed had {len(articles)})")

    today_articles = get_todays_articles(conn)
    print(f"  {len(today_articles)} articles for today's digest")
    if not today_articles:
        print("  Nothing to send today — exiting.")
        conn.close()
        return

    historical = get_historical_articles(conn)
    print(f"  {len(historical)} historical articles loaded for trend analysis")

    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    print("  Generating per-article summaries…")
    summaries = generate_summaries(claude, today_articles)

    print("  Generating trend insights…")
    insights = generate_insights(claude, today_articles, historical)

    save_summaries(conn, today_articles, summaries)
    conn.close()

    date_str = datetime.now().strftime("%B %d, %Y")
    html = build_html(today_articles, summaries, insights, date_str)

    print("  Sending email…")
    send_email(html, date_str)

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Done.")


if __name__ == "__main__":
    main()
