import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a financial and technology research analyst. Given a news article, identify the PRIMARY company being covered and return structured data about it from your training knowledge.

Return ONLY a valid JSON object with this exact structure — no markdown fences, no extra text:
{
  "company_name": "Name of the primary company (null if article covers no specific company)",
  "what_it_does": "2-3 sentences describing the company's core business model and product/service",
  "founded_year": 2003,
  "is_public": true,
  "ticker": "TSLA",
  "exchange": "NASDAQ",
  "total_funding": null,
  "key_funding_rounds": [],
  "revenue": "$97.7B (FY2024)",
  "net_income": "$7.1B (FY2024)"
}

Rules:
- For public companies: is_public=true, include ticker+exchange, set total_funding=null, key_funding_rounds=[]
- For private/startup companies: is_public=false, ticker=null, exchange=null, include total_funding and key_funding_rounds if known
- Use null for any values you don't know with reasonable confidence
- Prefix uncertain/estimated figures with "~"
- revenue and net_income should be the most recent annual figures you know
- If the article is about policy, industry trends, or covers no specific company, set company_name=null and fill other fields with null/defaults`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let title: string, content: string, author: string;
  try {
    ({ title, content, author } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Title: ${title}\nAuthor: ${author}\nContent: ${content.slice(0, 2500)}`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const text = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const intel = JSON.parse(text);
    intel.key_funding_rounds = intel.key_funding_rounds ?? [];
    return NextResponse.json(intel);
  } catch (err) {
    console.error("[company-intel]", err);
    return NextResponse.json(
      { error: "Failed to generate company intel" },
      { status: 500 }
    );
  }
}
