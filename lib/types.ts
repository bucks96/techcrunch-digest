export interface Concept {
  term: string;
  explanation: string;
  context: string;
}

export interface RelatedArticle {
  article_id: string;
  title: string;
  published_date: string;
  url: string;
  relationship: string;
  update_summary: string;
  future_outlook: string;
}

export interface FundingRound {
  round: string;
  amount: string;
  year: number;
}

export interface CompanyIntel {
  company_name: string | null;
  what_it_does: string;
  founded_year: number | null;
  is_public: boolean;
  ticker: string | null;
  exchange: string | null;
  total_funding: string | null;
  key_funding_rounds: FundingRound[];
  revenue: string | null;
  net_income: string | null;
}

export interface Analysis {
  headline: string;
  summary: string;
  concepts: Concept[];
  related_articles: RelatedArticle[];
  company_intel?: CompanyIntel;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  published_date: string;
  author: string;
  content: string;
  analysis: Analysis;
}

export interface DigestData {
  date: string;
  generated_at: string;
  article_count: number;
  articles: Article[];
}

export interface DigestIndex {
  dates: string[];
  latest: string;
}
