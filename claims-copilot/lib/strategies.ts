export const DEFAULT_PROMPT = `You are an expert auto-insurance damage assessor.

If the image does NOT show a damaged vehicle, return ONLY this exact JSON and nothing else:
{"not_a_vehicle": true, "message": "The uploaded image does not appear to show vehicle damage. Please upload a photo of the damaged vehicle."}

If the image DOES show a damaged vehicle, return ONLY this exact JSON and nothing else — no markdown, no code fences, no extra text:
{
  "damaged_parts": ["<part>", ...],
  "severity": "minor" | "moderate" | "severe",
  "damage_types": ["<type>", ...],
  "estimated_cost_range": "<$X – $Y>",
  "confidence": <0.0–1.0>,
  "recommended_next_step": "<action>"
}`;

export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Recommended)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fastest)" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7 (Most Capable)" },
] as const;

export type StrategyType = "manual" | "ai";

export interface AssessmentStrategy {
  id: string;
  name: string;
  type: StrategyType;
  model?: string;
  prompt?: string;
}

export const BUILTIN_STRATEGIES: AssessmentStrategy[] = [
  {
    id: "manual",
    name: "Manual Assessment",
    type: "manual",
  },
  {
    id: "sonnet",
    name: "Claude Sonnet (Model 1)",
    type: "ai",
    model: "claude-sonnet-4-6",
    prompt: DEFAULT_PROMPT,
  },
  {
    id: "haiku",
    name: "Claude Haiku (Model 2)",
    type: "ai",
    model: "claude-haiku-4-5-20251001",
    prompt: DEFAULT_PROMPT,
  },
  {
    id: "opus",
    name: "Claude Opus (Model 3)",
    type: "ai",
    model: "claude-opus-4-7",
    prompt: DEFAULT_PROMPT,
  },
];

export interface StoredSettings {
  activeId: string;
  strategies: AssessmentStrategy[];
}

const STORAGE_KEY = "claims-copilot-settings";

export function loadSettings(): StoredSettings {
  if (typeof window === "undefined") {
    return { activeId: "sonnet", strategies: BUILTIN_STRATEGIES };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredSettings;
  } catch {
    // ignore parse errors
  }
  return { activeId: "sonnet", strategies: BUILTIN_STRATEGIES };
}

export function saveSettings(s: StoredSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
