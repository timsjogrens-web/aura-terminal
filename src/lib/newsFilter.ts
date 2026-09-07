import { FinnhubNewsItem } from "./finnhub";

// Finnhub's free-tier /company-news endpoint tags articles with whatever
// symbol was queried regardless of whether the article is actually about
// that company (verified: only ~20% of "NVDA"-tagged results even mention
// Nvidia). Rather than show mistagged headlines as if they were real
// per-company news, we only keep articles that genuinely name the company.
function cleanCompanyName(name: string): string {
  return name
    .replace(/^(The)\s+/i, "")
    .replace(
      /,?\s*(Incorporated|Inc\.?|Corporation|Corp\.?|Company|Co\.?|Group|Holdings|plc|Ltd\.?|Limited)\.?\s*$/i,
      ""
    )
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterRelevantNews(
  items: FinnhubNewsItem[],
  companyName: string
): FinnhubNewsItem[] {
  const cleaned = cleanCompanyName(companyName);
  if (!cleaned) return [];

  const words = cleaned.split(/\s+/).filter(Boolean);
  const primary = words[0] && words[0].length >= 4 ? words[0] : cleaned;
  const terms = Array.from(new Set([cleaned, primary])).filter((t) => t.length >= 3);
  if (terms.length === 0) return [];

  const regexes = terms.map((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, "i"));

  return items.filter((item) => {
    const text = `${item.headline} ${item.summary ?? ""}`;
    return regexes.some((re) => re.test(text));
  });
}
