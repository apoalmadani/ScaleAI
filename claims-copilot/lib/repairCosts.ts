// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepairCostEntry {
  part: string;        // canonical part name, e.g. "front bumper"
  minCost: number;     // USD
  maxCost: number;     // USD
  laborHours: number;  // estimated labour hours
}

export interface RepairDbSettings {
  enabled: boolean;
  entries: RepairCostEntry[];
}

// ── Default price database ────────────────────────────────────────────────────

export const DEFAULT_ENTRIES: RepairCostEntry[] = [
  { part: "front bumper",    minCost: 500,  maxCost: 1500, laborHours: 3 },
  { part: "rear bumper",     minCost: 400,  maxCost: 1200, laborHours: 3 },
  { part: "hood",            minCost: 800,  maxCost: 2500, laborHours: 4 },
  { part: "front door",      minCost: 1200, maxCost: 3000, laborHours: 6 },
  { part: "rear door",       minCost: 1000, maxCost: 2800, laborHours: 5 },
  { part: "fender",          minCost: 400,  maxCost: 1200, laborHours: 3 },
  { part: "trunk lid",       minCost: 600,  maxCost: 2000, laborHours: 3 },
  { part: "roof",            minCost: 1500, maxCost: 4000, laborHours: 8 },
  { part: "windshield",      minCost: 300,  maxCost: 1200, laborHours: 2 },
  { part: "side window",     minCost: 150,  maxCost: 500,  laborHours: 1 },
  { part: "rear window",     minCost: 250,  maxCost: 900,  laborHours: 2 },
  { part: "headlight",       minCost: 200,  maxCost: 1500, laborHours: 1 },
  { part: "taillight",       minCost: 150,  maxCost: 1000, laborHours: 1 },
  { part: "mirror",          minCost: 100,  maxCost: 600,  laborHours: 1 },
  { part: "quarter panel",   minCost: 800,  maxCost: 2500, laborHours: 5 },
  { part: "rocker panel",    minCost: 300,  maxCost: 1000, laborHours: 3 },
  { part: "radiator",        minCost: 400,  maxCost: 1500, laborHours: 3 },
  { part: "airbag",          minCost: 1000, maxCost: 3500, laborHours: 4 },
];

// ── Pure lookup function (safe to call server-side) ───────────────────────────

export interface PartCost {
  min: number;
  max: number;
  laborHours: number;
}

/**
 * Look up cost data for the given part names.
 * Uses case-insensitive substring matching as a fuzzy match.
 * Returns null for parts not found in the database.
 */
export function lookupParts(
  parts: string[],
  entries: RepairCostEntry[]
): Record<string, PartCost | null> {
  const result: Record<string, PartCost | null> = {};

  for (const part of parts) {
    const needle = part.toLowerCase().trim();
    const found = entries.find(
      (e) =>
        e.part.toLowerCase() === needle ||
        e.part.toLowerCase().includes(needle) ||
        needle.includes(e.part.toLowerCase())
    );
    result[part] = found
      ? { min: found.minCost, max: found.maxCost, laborHours: found.laborHours }
      : null;
  }

  return result;
}

// ── localStorage helpers (client-side only) ───────────────────────────────────

const REPAIR_DB_KEY = "claims-copilot-repair-db";

export function loadRepairDb(): RepairDbSettings {
  if (typeof window === "undefined") {
    return { enabled: true, entries: DEFAULT_ENTRIES };
  }
  try {
    const raw = localStorage.getItem(REPAIR_DB_KEY);
    if (raw) return JSON.parse(raw) as RepairDbSettings;
  } catch {
    // ignore parse errors — fall through to default
  }
  return { enabled: true, entries: DEFAULT_ENTRIES };
}

export function saveRepairDb(db: RepairDbSettings): void {
  localStorage.setItem(REPAIR_DB_KEY, JSON.stringify(db));
}
