// Minimal client for Turso's HTTP "pipeline" API (the Hrana-over-HTTP v2
// protocol: https://docs.turso.tech/sdk/http/reference). Talking to it with
// plain fetch — the same pattern already used for Finnhub/Yahoo — avoids
// @libsql/client's native per-OS binaries entirely, which is what was
// hanging Vercel's build (it tries to fetch a Linux native package that
// isn't needed for a purely remote HTTP connection).

export class TursoError extends Error {}

type ArgValue = string | number | boolean | null | undefined;
type Args = ArgValue[] | Record<string, ArgValue>;

export interface TursoRow {
  [column: string]: string | number | null;
}

export interface TursoResultSet {
  rows: TursoRow[];
  lastInsertRowid: number | null;
}

interface HranaValue {
  type: "null" | "integer" | "float" | "text" | "blob";
  value?: string | number;
  base64?: string;
}

interface HranaCol {
  name: string;
}

interface HranaExecuteResult {
  cols: HranaCol[];
  rows: HranaValue[][];
  last_insert_rowid?: string | null;
}

interface HranaPipelineResponse {
  results: Array<
    | { type: "ok"; response: { type: "execute"; result: HranaExecuteResult } | { type: "close" } }
    | { type: "error"; error: { message: string; code?: string } }
  >;
}

function encodeValue(v: ArgValue): HranaValue {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  }
  if (typeof v === "boolean") return { type: "integer", value: v ? "1" : "0" };
  return { type: "text", value: v };
}

function decodeValue(v: HranaValue): string | number | null {
  switch (v.type) {
    case "null":
      return null;
    case "integer":
      return Number(v.value);
    case "float":
      return typeof v.value === "number" ? v.value : Number(v.value);
    case "text":
      return String(v.value ?? "");
    case "blob":
      return v.base64 ?? null;
    default:
      return null;
  }
}

function httpUrlFor(databaseUrl: string): string {
  return databaseUrl.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";
}

async function pipeline(
  databaseUrl: string,
  authToken: string,
  sql: string,
  args?: Args
): Promise<HranaExecuteResult> {
  const stmt: Record<string, unknown> = { sql, want_rows: true };
  if (Array.isArray(args)) {
    stmt.args = args.map(encodeValue);
  } else if (args && typeof args === "object") {
    stmt.named_args = Object.entries(args).map(([name, value]) => ({
      name,
      value: encodeValue(value),
    }));
  }

  let res: Response;
  try {
    res = await fetch(httpUrlFor(databaseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ type: "execute", stmt }, { type: "close" }],
      }),
      cache: "no-store",
    });
  } catch (e) {
    throw new TursoError(`Network error contacting Turso: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TursoError(`Turso request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as HranaPipelineResponse;
  const first = json.results[0];
  if (!first || first.type === "error") {
    throw new TursoError(first?.error?.message ?? "Unknown Turso error.");
  }
  if (first.response.type !== "execute") {
    throw new TursoError("Unexpected Turso response shape.");
  }
  return first.response.result;
}

export interface TursoClient {
  execute(query: string | { sql: string; args?: Args }): Promise<TursoResultSet>;
}

export function createTursoClient(url: string, authToken: string): TursoClient {
  return {
    async execute(query) {
      const sql = typeof query === "string" ? query : query.sql;
      const args = typeof query === "string" ? undefined : query.args;

      const result = await pipeline(url, authToken, sql, args);
      const colNames = result.cols.map((c) => c.name);
      const rows: TursoRow[] = result.rows.map((row) => {
        const obj: TursoRow = {};
        row.forEach((cell, i) => {
          obj[colNames[i]] = decodeValue(cell);
        });
        return obj;
      });

      return {
        rows,
        lastInsertRowid: result.last_insert_rowid ? Number(result.last_insert_rowid) : null,
      };
    },
  };
}
