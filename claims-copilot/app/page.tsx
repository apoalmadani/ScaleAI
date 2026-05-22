"use client";

import { useRef, useState, ChangeEvent } from "react";

interface Assessment {
  damaged_parts: string[];
  severity: "minor" | "moderate" | "severe";
  damage_types: string[];
  estimated_cost_range: string;
  confidence: number;
  recommended_next_step: string;
}

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

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [policyNumber, setPolicyNumber] = useState("");
  const [claimId, setClaimId] = useState("");
  const [description, setDescription] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>("");

  const [editedAssessment, setEditedAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "approved" | "flagged">("idle");

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setImageMediaType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);

    setEditedAssessment(null);
    setStatus("idle");
    setError(null);
  }

  async function handleAssess() {
    if (!imageBase64) {
      setError("Please upload a vehicle damage image first.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus("idle");
    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, mediaType: imageMediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assessment failed");
      setEditedAssessment(data as Assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof Assessment>(key: K, value: Assessment[K]) {
    if (!editedAssessment) return;
    setEditedAssessment({ ...editedAssessment, [key]: value });
  }

  function updateArrayField(key: "damaged_parts" | "damage_types", raw: string) {
    if (!editedAssessment) return;
    setEditedAssessment({
      ...editedAssessment,
      [key]: raw.split(",").map((s) => s.trim()).filter(Boolean),
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Claims Copilot</h1>
          <p className="text-sm text-gray-500 mt-1">Auto-insurance damage assessment assistant</p>
        </div>

        {/* Claim Intake Form */}
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-base font-medium text-gray-800">Claim Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Policy Number</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="POL-000000"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Claim ID</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="CLM-000000"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Incident Description</label>
            <textarea
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
              placeholder="Briefly describe what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </section>

        {/* Image Upload */}
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-base font-medium text-gray-800">Vehicle Damage Photo</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Vehicle damage preview"
                className="max-h-64 mx-auto rounded object-contain"
              />
            ) : (
              <div className="text-gray-400 space-y-1">
                <div className="text-3xl">📷</div>
                <p className="text-sm">Click to upload damage photo</p>
                <p className="text-xs">JPG, PNG, WEBP up to 20 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageChange}
          />
          {previewUrl && (
            <button
              className="text-xs text-gray-400 hover:text-gray-600 underline"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace image
            </button>
          )}
        </section>

        {/* Run Assessment */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAssess}
            disabled={loading || !imageBase64}
            className="bg-gray-900 text-white text-sm px-5 py-2.5 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition-colors font-medium"
          >
            {loading ? "Assessing…" : "Run AI Assessment"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Assessment Card */}
        {editedAssessment && (
          <section className="bg-white rounded-lg border p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-800">Assessment</h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${confidenceColor(editedAssessment.confidence)}`}>
                  Confidence {Math.round(editedAssessment.confidence * 100)}%
                </span>
                {status === "approved" && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">Approved</span>
                )}
                {status === "flagged" && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">Flagged</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Severity</label>
                <select
                  value={editedAssessment.severity}
                  onChange={(e) => updateField("severity", e.target.value as Assessment["severity"])}
                  className={`w-full border rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400 ${SEVERITY_COLOR[editedAssessment.severity]}`}
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Estimated Cost Range</label>
                <input
                  type="text"
                  value={editedAssessment.estimated_cost_range}
                  onChange={(e) => updateField("estimated_cost_range", e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                  Damaged Parts <span className="normal-case font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={editedAssessment.damaged_parts.join(", ")}
                  onChange={(e) => updateArrayField("damaged_parts", e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                  Damage Types <span className="normal-case font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={editedAssessment.damage_types.join(", ")}
                  onChange={(e) => updateArrayField("damage_types", e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Confidence (0–1)</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={editedAssessment.confidence}
                  onChange={(e) => updateField("confidence", parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Recommended Next Step</label>
                <input
                  type="text"
                  value={editedAssessment.recommended_next_step}
                  onChange={(e) => updateField("recommended_next_step", e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <button
                onClick={() => setStatus("approved")}
                disabled={status === "approved"}
                className="flex-1 bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors font-medium"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => setStatus("flagged")}
                disabled={status === "flagged"}
                className="flex-1 border border-orange-400 text-orange-600 text-sm py-2 rounded-lg hover:bg-orange-50 disabled:opacity-40 transition-colors font-medium"
              >
                ⚑ Flag for Senior Adjuster
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
