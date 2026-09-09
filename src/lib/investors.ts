export interface InstitutionalManager {
  slug: string;
  name: string;
  fund: string;
  cik: string; // verified against SEC EDGAR company search, not guessed
  // Freely-licensed (Wikipedia/Wikimedia Commons) photo, hotlinked rather
  // than rehosted. Not every manager has a free photo available — those
  // fall back to an initials avatar in the UI instead of a guessed image.
  photoUrl?: string;
}

// SEC 13F filers only — Nancy Pelosi-style congressional trade disclosures
// come from a different, non-13F source and aren't included here.
export const MANAGERS: InstitutionalManager[] = [
  {
    slug: "buffett",
    name: "Warren Buffett",
    fund: "Berkshire Hathaway",
    cik: "1067983",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/330px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg",
  },
  {
    slug: "ackman",
    name: "Bill Ackman",
    fund: "Pershing Square",
    cik: "2026053",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/0/07/Valeant_Pharmaceuticals%27_Business_Model_%28headshot%29.jpg",
  },
  {
    slug: "druckenmiller",
    name: "Stanley Druckenmiller",
    fund: "Duquesne Family Office",
    cik: "1536411",
  },
  {
    slug: "tepper",
    name: "David Tepper",
    fund: "Appaloosa",
    cik: "1656456",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/David_Tepper_01.jpg/330px-David_Tepper_01.jpg",
  },
  {
    slug: "klarman",
    name: "Seth Klarman",
    fund: "Baupost Group",
    cik: "1061768",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Seth_Klarman_at_147th_Preakness_Stakes.jpg/330px-Seth_Klarman_at_147th_Preakness_Stakes.jpg",
  },
  { slug: "coleman", name: "Chase Coleman", fund: "Tiger Global", cik: "1167483" },
  {
    slug: "hohn",
    name: "Chris Hohn",
    fund: "TCI Fund Management",
    cik: "1647251",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Chris_Hohn_GFSS_2023.jpg/330px-Chris_Hohn_GFSS_2023.jpg",
  },
  { slug: "li-lu", name: "Li Lu", fund: "Himalaya Capital", cik: "1709323" },
  {
    slug: "smith",
    name: "Terry Smith",
    fund: "Fundsmith",
    cik: "1569205",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Terry_Smith_MNZM_investiture.jpg/330px-Terry_Smith_MNZM_investiture.jpg",
  },
  {
    slug: "soros",
    name: "George Soros",
    fund: "Soros Fund Management",
    cik: "1029160",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/George_Soros%2C_Founder_and_Chairman_of_the_Open_Society_Foundations%2C_visits_the_EC_%283x4_cropped%29.jpg/330px-George_Soros%2C_Founder_and_Chairman_of_the_Open_Society_Foundations%2C_visits_the_EC_%283x4_cropped%29.jpg",
  },
  {
    slug: "gates",
    name: "Bill Gates",
    fund: "Gates Foundation Trust",
    cik: "1166559",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Bill_Gates_at_the_European_Commission_-_P067383-987995_%28cropped%29_5.jpg/330px-Bill_Gates_at_the_European_Commission_-_P067383-987995_%28cropped%29_5.jpg",
  },
  { slug: "burry", name: "Michael Burry", fund: "Scion Asset Management", cik: "1649339" },
];

export const MANAGERS_BY_SLUG = new Map(MANAGERS.map((m) => [m.slug, m]));

export function formatValue(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
