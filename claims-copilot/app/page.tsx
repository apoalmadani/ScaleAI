"use client";

import { useRef, useState, useEffect, ChangeEvent } from "react";
import Link from "next/link";
import {
  AssessmentStrategy,
  BUILTIN_STRATEGIES,
  loadSettings,
} from "@/lib/strategies";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface ClaimData {
  policyholderName: string;
  policyholderPhone: string;
  policyNumber: string;
  claimId: string;
  incidentDate: string;
  incidentType: "collision" | "weather" | "theft" | "vandalism" | "other";
  incidentLocation: string;
  thirdPartyInvolved: boolean;
  description: string;
}

interface Assessment {
  damaged_parts: string[];
  severity: "minor" | "moderate" | "severe";
  damage_types: string[];
  estimated_cost_range: string;
  confidence: number;
  recommended_next_step: string;
}

interface Escalation {
  reason: "high_value" | "disputed" | "fraud_suspected" | "complex_damage" | "other";
  notes: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  minor: "bg-green-100 text-green-800",
  moderate: "bg-yellow-100 text-yellow-800",
  severe: "bg-red-100 text-red-800",
};

function confidenceColor(c: number) {
  if (c >= 0.75) return "bg-green-100 text-green-800";
  if (c >= 0.5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STEP_LABELS: Record<Step, string> = {
  1: "Initiation",
  2: "Documentation",
  3: "Assessment",
  4: "Decision",
};

const EMPTY_CLAIM: ClaimData = {
  policyholderName: "",
  policyholderPhone: "",
  policyNumber: "",
  claimId: "",
  incidentDate: "",
  incidentType: "collision",
  incidentLocation: "",
  thirdPartyInvolved: false,
  description: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current, maxReached }: { current: Step; maxReached: Step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {([1, 2, 3, 4] as Step[]).map((s, i) => {
        const done = s < current;
        const active = s === current;
        const reachable = s <= maxReached;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center gap-1 ${reachable ? "cursor-default" : "opacity-40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors
                ${active ? "border-gray-900 bg-gray-900 text-white" : done ? "border-gray-900 bg-white text-gray-900" : "border-gray-300 bg-white text-gray-400"}`}>
                {done ? "✓" : s}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? "text-gray-900" : "text-gray-400"}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < 3 && <div className={`flex-1 h-0.5 mx-2 mb-4 ${s < current ? "bg-gray-900" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function RoleBadge({ role }: { role: "Claims Agent" | "Policyholder" | "Claims Agent + Senior Adjuster" }) {
  const colors: Record<string, string> = {
    "Claims Agent": "bg-blue-100 text-blue-700",
    "Policyholder": "bg-purple-100 text-purple-700",
    "Claims Agent + Senior Adjuster": "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role]}`}>
      {role}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{children}</label>;
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-gray-500 capitalize">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStrategy, setActiveStrategy] = useState<AssessmentStrategy>(
    BUILTIN_STRATEGIES.find((s) => s.id === "sonnet")!
  );

  useEffect(() => {
    const { activeId, strategies } = loadSettings();
    const found = strategies.find((s) => s.id === activeId);
    if (found) setActiveStrategy(found);
  }, []);

  const [step, setStep] = useState<Step>(1);
  const [maxReached, setMaxReached] = useState<Step>(1);

  const [claim, setClaim] = useState<ClaimData>(EMPTY_CLAIM);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>("");

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [adjusterNotes, setAdjusterNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);

  // Step 4 state
  type DecisionState = "idle" | "approved" | "escalating" | "escalated";
  const [decision, setDecision] = useState<DecisionState>("idle");
  const [escalation, setEscalation] = useState<Escalation>({ reason: "high_value", notes: "" });

  function goTo(s: Step) {
    setStep(s);
    if (s > maxReached) setMaxReached(s);
  }

  function updateClaim<K extends keyof ClaimData>(key: K, value: ClaimData[K]) {
    setClaim((prev) => ({ ...prev, [key]: value }));
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setImageMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => setImageBase64((reader.result as string).split(",")[1]);
    reader.readAsDataURL(file);
    setAssessment(null);
    setAssessError(null);
  }

  const EMPTY_ASSESSMENT: Assessment = {
    damaged_parts: [],
    severity: "minor",
    damage_types: [],
    estimated_cost_range: "",
    confidence: 1.0,
    recommended_next_step: "",
  };

  async function handleAssess() {
    if (!imageBase64) return;
    setLoading(true);
    setAssessError(null);
    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          mediaType: imageMediaType,
          model: activeStrategy.model,
          systemPrompt: activeStrategy.prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assessment failed");
      setAssessment(data as Assessment);
    } catch (err) {
      setAssessError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function startManual() {
    setAssessment(EMPTY_ASSESSMENT);
    setAssessError(null);
  }

  function updateAssessment<K extends keyof Assessment>(key: K, value: Assessment[K]) {
    if (!assessment) return;
    setAssessment({ ...assessment, [key]: value });
  }

  function updateArrayField(key: "damaged_parts" | "damage_types", raw: string) {
    if (!assessment) return;
    setAssessment({ ...assessment, [key]: raw.split(",").map((s) => s.trim()).filter(Boolean) });
  }

  function resetAll() {
    setStep(1);
    setMaxReached(1);
    setClaim(EMPTY_CLAIM);
    setPreviewUrl(null);
    setImageBase64(null);
    setImageMediaType("");
    setAssessment(null);
    setAdjusterNotes("");
    setAssessError(null);
    setDecision("idle");
    setEscalation({ reason: "high_value", notes: "" });
  }

  const authRef = claim.claimId
    ? `AUTH-${claim.claimId.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`
    : `AUTH-${Date.now()}`;
  const escalRef = `ESC-${claim.claimId?.toUpperCase() || Date.now()}`;

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const step1Valid = claim.policyNumber.trim() !== "" && claim.claimId.trim() !== "";

  const renderStep1 = () => (
    <section className="bg-white rounded-lg border p-6 space-y-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-gray-900">Claim Initiation</h2>
          <p className="text-xs text-gray-400 mt-0.5">Agent collects details from policyholder contact</p>
        </div>
        <RoleBadge role="Claims Agent" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Policyholder Name</Label>
          <Input placeholder="Jane Smith" value={claim.policyholderName} onChange={(e) => updateClaim("policyholderName", e.target.value)} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input type="tel" placeholder="+1 555 000 0000" value={claim.policyholderPhone} onChange={(e) => updateClaim("policyholderPhone", e.target.value)} />
        </div>
        <div>
          <Label>Policy Number *</Label>
          <Input placeholder="POL-000000" value={claim.policyNumber} onChange={(e) => updateClaim("policyNumber", e.target.value)} />
        </div>
        <div>
          <Label>Claim ID *</Label>
          <Input placeholder="CLM-000000" value={claim.claimId} onChange={(e) => updateClaim("claimId", e.target.value)} />
        </div>
        <div>
          <Label>Incident Date</Label>
          <Input type="date" value={claim.incidentDate} onChange={(e) => updateClaim("incidentDate", e.target.value)} />
        </div>
        <div>
          <Label>Incident Type</Label>
          <select
            className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            value={claim.incidentType}
            onChange={(e) => updateClaim("incidentType", e.target.value as ClaimData["incidentType"])}
          >
            <option value="collision">Collision</option>
            <option value="weather">Weather / Natural event</option>
            <option value="theft">Theft / Vandalism</option>
            <option value="vandalism">Vandalism</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="col-span-2">
          <Label>Incident Location</Label>
          <Input placeholder="123 Main St, City, State" value={claim.incidentLocation} onChange={(e) => updateClaim("incidentLocation", e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Third Party Involved?</Label>
          <div className="flex gap-6 mt-1">
            {[true, false].map((val) => (
              <label key={String(val)} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="thirdParty" checked={claim.thirdPartyInvolved === val} onChange={() => updateClaim("thirdPartyInvolved", val)} className="accent-gray-900" />
                {val ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <Label>Incident Description</Label>
          <textarea
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
            placeholder="Briefly describe what happened..."
            value={claim.description}
            onChange={(e) => updateClaim("description", e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button
          disabled={!step1Valid}
          onClick={() => goTo(2)}
          className="bg-gray-900 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition-colors font-medium"
        >
          Next: Upload Photos →
        </button>
      </div>
    </section>
  );

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <section className="bg-white rounded-lg border p-6 space-y-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-gray-900">Damage Documentation</h2>
          <p className="text-xs text-gray-400 mt-0.5">Policyholder submits photos; agent uploads on their behalf</p>
        </div>
        <RoleBadge role="Policyholder" />
      </div>
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Vehicle damage preview" className="max-h-64 mx-auto rounded object-contain" />
        ) : (
          <div className="text-gray-400 space-y-1">
            <div className="text-3xl">📷</div>
            <p className="text-sm">Click to upload damage photo</p>
            <p className="text-xs">JPG, PNG, WEBP up to 20 MB</p>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
      {previewUrl && (
        <div className="flex gap-3">
          <button className="text-xs text-gray-500 hover:text-gray-700 underline" onClick={() => fileInputRef.current?.click()}>
            Replace image
          </button>
          <button
            className="text-xs text-red-400 hover:text-red-600 underline"
            onClick={() => {
              setPreviewUrl(null);
              setImageBase64(null);
              setImageMediaType("");
              setAssessment(null);
              setAssessError(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Clear
          </button>
        </div>
      )}
      <div className="flex justify-between pt-2">
        <button onClick={() => goTo(1)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border hover:border-gray-400 transition-colors">
          ← Back
        </button>
        <button
          disabled={!imageBase64}
          onClick={() => {
            goTo(3);
            if (activeStrategy.type === "manual") startManual();
            else handleAssess();
          }}
          className="bg-gray-900 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition-colors font-medium"
        >
          {activeStrategy.type === "manual" ? "Next: Enter Manually →" : "Next: Run Assessment →"}
        </button>
      </div>
    </section>
  );

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-4">
      <section className="bg-white rounded-lg border p-6 space-y-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-medium text-gray-900">
              {activeStrategy.type === "manual" ? "Manual Assessment" : "AI Damage Assessment"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeStrategy.type === "manual"
                ? "Fill in the damage estimate manually"
                : "AI analyses the photo; agent reviews and corrects the estimate"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {activeStrategy.name}
            </span>
            <RoleBadge role="Claims Agent" />
          </div>
        </div>

        {previewUrl && (
          <div className="space-y-1">
            <img src={previewUrl} alt="Uploaded damage" className="max-h-40 rounded object-contain border" />
            <button
              className="text-xs text-red-400 hover:text-red-600 underline"
              onClick={() => {
                setPreviewUrl(null);
                setImageBase64(null);
                setImageMediaType("");
                setAssessment(null);
                setAssessError(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                goTo(2);
              }}
            >
              Change photo
            </button>
          </div>
        )}

        {activeStrategy.type === "ai" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAssess}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-900 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition-colors font-medium"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? "Analysing…" : assessment ? "Re-run Assessment" : "Run AI Assessment"}
            </button>
            {assessError && <p className="text-sm text-red-600">{assessError}</p>}
          </div>
        )}

        {assessment && (
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Assessment Results</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${confidenceColor(assessment.confidence)}`}>
                Confidence {Math.round(assessment.confidence * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>Severity</Label>
                <select
                  value={assessment.severity}
                  onChange={(e) => updateAssessment("severity", e.target.value as Assessment["severity"])}
                  className={`w-full border rounded px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 ${SEVERITY_COLOR[assessment.severity]}`}
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div>
                <Label>Estimated Cost Range</Label>
                <Input value={assessment.estimated_cost_range} onChange={(e) => updateAssessment("estimated_cost_range", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Damaged Parts <span className="normal-case font-normal">(comma-separated)</span></Label>
                <Input value={assessment.damaged_parts.join(", ")} onChange={(e) => updateArrayField("damaged_parts", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Damage Types <span className="normal-case font-normal">(comma-separated)</span></Label>
                <Input value={assessment.damage_types.join(", ")} onChange={(e) => updateArrayField("damage_types", e.target.value)} />
              </div>
              <div>
                <Label>Confidence (0–1)</Label>
                <Input type="number" min={0} max={1} step={0.01} value={assessment.confidence}
                  onChange={(e) => updateAssessment("confidence", parseFloat(e.target.value))} />
              </div>
              <div className="col-span-2">
                <Label>Recommended Next Step</Label>
                <Input value={assessment.recommended_next_step} onChange={(e) => updateAssessment("recommended_next_step", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Adjuster Notes</Label>
                <textarea
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                  placeholder="Add your observations or overrides here…"
                  value={adjusterNotes}
                  onChange={(e) => setAdjusterNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <button onClick={() => goTo(2)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border hover:border-gray-400 transition-colors">
          ← Back
        </button>
        <button
          disabled={!assessment}
          onClick={() => goTo(4)}
          className="bg-gray-900 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition-colors font-medium"
        >
          Continue to Decision →
        </button>
      </div>
    </div>
  );

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const renderStep4 = () => {
    if (decision === "approved") {
      return (
        <section className="bg-white rounded-lg border p-6 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto text-2xl">✓</div>
          <h2 className="text-lg font-semibold text-gray-900">Authorization Issued</h2>
          <p className="text-sm text-gray-500">Reference: <span className="font-mono font-medium text-gray-800">{authRef}</span></p>
          <div className="text-left bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <SummaryRow label="Policy" value={claim.policyNumber} />
            <SummaryRow label="Claim ID" value={claim.claimId} />
            <SummaryRow label="Severity" value={assessment!.severity} />
            <SummaryRow label="Approved cost range" value={assessment!.estimated_cost_range} />
          </div>
          <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
            Policyholder is authorized to take the vehicle to an approved repair shop. The repair shop will conduct its own assessment and negotiate the final price with the insurance company.
          </p>
          <button onClick={resetAll} className="mt-2 text-sm text-gray-500 underline hover:text-gray-700">Start New Claim</button>
        </section>
      );
    }

    if (decision === "escalated") {
      return (
        <section className="bg-white rounded-lg border p-6 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto text-2xl">⚑</div>
          <h2 className="text-lg font-semibold text-gray-900">Escalated to Senior Adjuster</h2>
          <p className="text-sm text-gray-500">Reference: <span className="font-mono font-medium text-gray-800">{escalRef}</span></p>
          <p className="text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-lg p-3">
            A senior adjuster will review this claim within 24 hours. The policyholder will be notified of the outcome.
          </p>
          <button onClick={resetAll} className="mt-2 text-sm text-gray-500 underline hover:text-gray-700">Start New Claim</button>
        </section>
      );
    }

    return (
      <div className="space-y-4">
        {/* Claim + assessment summary */}
        <section className="bg-white rounded-lg border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-gray-900">Claim Summary</h2>
            <RoleBadge role="Claims Agent + Senior Adjuster" />
          </div>
          <div className="grid grid-cols-2 gap-x-8 text-sm">
            <div className="space-y-0">
              <SummaryRow label="Policyholder" value={claim.policyholderName || "—"} />
              <SummaryRow label="Policy" value={claim.policyNumber} />
              <SummaryRow label="Claim ID" value={claim.claimId} />
              <SummaryRow label="Incident date" value={formatDate(claim.incidentDate)} />
              <SummaryRow label="Type" value={claim.incidentType} />
            </div>
            <div className="space-y-0">
              <SummaryRow label="Severity" value={assessment!.severity} />
              <SummaryRow label="Cost range" value={assessment!.estimated_cost_range} />
              <SummaryRow label="Damaged parts" value={assessment!.damaged_parts.join(", ")} />
              <SummaryRow label="Confidence" value={`${Math.round(assessment!.confidence * 100)}%`} />
              {adjusterNotes && <SummaryRow label="Adjuster notes" value={adjusterNotes} />}
            </div>
          </div>
        </section>

        {/* Decision panel */}
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-base font-medium text-gray-900">Adjuster Decision</h2>

          {decision === "idle" && (
            <div className="flex gap-3">
              <button
                onClick={() => setDecision("approved")}
                className="flex-1 bg-gray-900 text-white text-sm py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                ✓ Approve & Authorize Repair
              </button>
              <button
                onClick={() => setDecision("escalating")}
                className="flex-1 border border-orange-400 text-orange-600 text-sm py-2.5 rounded-lg hover:bg-orange-50 transition-colors font-medium"
              >
                ⚑ Flag for Senior Adjuster
              </button>
            </div>
          )}

          {decision === "escalating" && (
            <div className="space-y-3">
              <div>
                <Label>Escalation Reason</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                  value={escalation.reason}
                  onChange={(e) => setEscalation({ ...escalation, reason: e.target.value as Escalation["reason"] })}
                >
                  <option value="high_value">High value claim</option>
                  <option value="disputed">Disputed damage</option>
                  <option value="fraud_suspected">Fraud suspected</option>
                  <option value="complex_damage">Complex / multi-vehicle damage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label>Notes for Senior Adjuster</Label>
                <textarea
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                  placeholder="Add context for the reviewing adjuster…"
                  value={escalation.notes}
                  onChange={(e) => setEscalation({ ...escalation, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDecision("idle")} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => setDecision("escalated")}
                  className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                  Submit Escalation
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-start">
          <button onClick={() => goTo(3)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border hover:border-gray-400 transition-colors">
            ← Back to Assessment
          </button>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="border-b pb-4 mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Claims Copilot</h1>
            <p className="text-sm text-gray-500 mt-1">AI-powered auto-insurance damage assessment</p>
          </div>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>

        <StepIndicator current={step} maxReached={maxReached} />

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </main>
  );
}
