// signal_history only ever records a signal CHANGE, so two consecutive rows
// for the same ticker with the same signal can't be two real calls — they're
// the same signal written twice. That happened when two refresh runs
// overlapped (2026-09-20, before refresh got a lock and the ledger append
// became atomic). The stored rows are left alone; the stats just ignore the
// repeat so it isn't counted (and later scored) as a second call.
export function dropRepeatedSignals<T extends { signal: string | null }>(rowsInTimeOrder: T[]): T[] {
  const out: T[] = [];
  for (const row of rowsInTimeOrder) {
    const prev = out[out.length - 1];
    if (prev && prev.signal === row.signal) continue;
    out.push(row);
  }
  return out;
}
