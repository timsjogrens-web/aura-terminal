// A broader, less hand-picked universe than the live site's 39-ticker list
// — the full current S&P 500 constituent list — for research purposes
// only. Source: github.com/datasets/s-and-p-500-companies (a commonly used
// free mirror of Wikipedia's "List of S&P 500 companies"), pinned as a
// local CSV snapshot so research runs are reproducible.
//
// IMPORTANT CAVEAT: this is still not survivorship-bias-free. It's the
// CURRENT constituent list — companies that were in the S&P 500 at some
// point but were removed (acquired, delisted, bankrupt, demoted) before
// today are NOT included, which still biases results upward versus a true
// point-in-time historical membership list. Fixing that fully requires a
// paid data provider (Sharadar, Norgate, etc.), which was explicitly ruled
// out to keep the project free. This universe is a meaningfully fairer
// starting point than a hand-picked "known winners" list, not a complete
// fix.

import fs from "fs";
import path from "path";

const CSV_PATH = path.join(process.cwd(), "src/research/sp500-constituents.csv");

export interface Sp500Entry {
  ticker: string; // as listed (e.g. "BRK.B")
  yahooSymbol: string; // Yahoo's format (e.g. "BRK-B") — dots become hyphens
  name: string;
  sector: string;
  dateAdded: string | null;
}

// Minimal CSV parser handling quoted fields with embedded commas (e.g.
// "Saint Paul, Minnesota") — the only quoting this particular file uses.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

let cached: Sp500Entry[] | null = null;

export function getSp500Universe(): Sp500Entry[] {
  if (cached) return cached;
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const [, ...rows] = lines; // drop header
  cached = rows.map((line) => {
    const [symbol, name, sector, , , dateAdded] = parseCsvLine(line);
    return {
      ticker: symbol,
      yahooSymbol: symbol.replace(".", "-"),
      name,
      sector,
      dateAdded: dateAdded || null,
    };
  });
  return cached;
}
