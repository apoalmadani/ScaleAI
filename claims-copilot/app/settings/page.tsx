"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AssessmentStrategy,
  AVAILABLE_MODELS,
  BUILTIN_STRATEGIES,
  DEFAULT_PROMPT,
  StoredSettings,
  loadSettings,
  saveSettings,
} from "@/lib/strategies";
import {
  RepairCostEntry,
  RepairDbSettings,
  DEFAULT_ENTRIES,
  loadRepairDb,
  saveRepairDb,
} from "@/lib/repairCosts";

export default function SettingsPage() {
  // ── Assessment strategies ─────────────────────────────────────────────────
  const [settings, setSettings] = useState<StoredSettings>({
    activeId: "sonnet",
    strategies: BUILTIN_STRATEGIES,
  });

  // ── Repair cost database ──────────────────────────────────────────────────
  const [repairDb, setRepairDb] = useState<RepairDbSettings>({
    enabled: true,
    entries: DEFAULT_ENTRIES,
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setRepairDb(loadRepairDb());
  }, []);

  // ── Strategy helpers ──────────────────────────────────────────────────────
  function setActive(id: string) {
    setSettings((s) => ({ ...s, activeId: id }));
    setSaved(false);
  }

  function updateStrategy(id: string, patch: Partial<AssessmentStrategy>) {
    setSettings((s) => ({
      ...s,
      strategies: s.strategies.map((st) =>
        st.id === id ? { ...st, ...patch } : st
      ),
    }));
    setSaved(false);
  }

  function resetPrompt(id: string) {
    updateStrategy(id, { prompt: DEFAULT_PROMPT });
  }

  // ── Repair DB helpers ─────────────────────────────────────────────────────
  function toggleDb() {
    setRepairDb((db) => ({ ...db, enabled: !db.enabled }));
    setSaved(false);
  }

  function updateEntry(index: number, patch: Partial<RepairCostEntry>) {
    setRepairDb((db) => ({
      ...db,
      entries: db.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
    setSaved(false);
  }

  function resetDb() {
    setRepairDb({ enabled: repairDb.enabled, entries: DEFAULT_ENTRIES });
    setSaved(false);
  }

  // ── Save all settings ─────────────────────────────────────────────────────
  function handleSave() {
    saveSettings(settings);
    saveRepairDb(repairDb);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b pb-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure assessment strategies, AI prompts, and the repair price database
            </p>
          </div>
        </div>

        {/* ── Assessment strategies ─────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Assessment Strategy
          </h2>

          {settings.strategies.map((strategy) => {
            const isActive = settings.activeId === strategy.id;
            return (
              <div
                key={strategy.id}
                className={`bg-white rounded-lg border p-4 space-y-3 transition-colors ${
                  isActive ? "border-gray-900" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="strategy"
                    checked={isActive}
                    onChange={() => setActive(strategy.id)}
                    className="mt-1 accent-gray-900 cursor-pointer"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={strategy.name}
                        onChange={(e) =>
                          updateStrategy(strategy.id, { name: e.target.value })
                        }
                        className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none py-0.5"
                      />
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          strategy.type === "manual"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {strategy.type === "manual" ? "Manual" : "AI"}
                      </span>
                      {isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    {strategy.type === "manual" && (
                      <p className="text-xs text-gray-400">
                        Agent fills in all assessment fields manually — no AI
                        call is made.
                      </p>
                    )}

                    {strategy.type === "ai" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                            Model
                          </label>
                          <select
                            value={strategy.model}
                            onChange={(e) =>
                              updateStrategy(strategy.id, {
                                model: e.target.value,
                              })
                            }
                            className="w-full border rounded px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                          >
                            {AVAILABLE_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                              System Prompt
                            </label>
                            <button
                              onClick={() => resetPrompt(strategy.id)}
                              className="text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                              Reset to default
                            </button>
                          </div>
                          <textarea
                            rows={9}
                            value={strategy.prompt}
                            onChange={(e) =>
                              updateStrategy(strategy.id, {
                                prompt: e.target.value,
                              })
                            }
                            className="w-full border rounded px-3 py-2 text-xs text-gray-900 bg-white font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Repair cost database ──────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Repair Cost Database
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={resetDb}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reset to defaults
              </button>
              {/* Toggle switch */}
              <button
                onClick={toggleDb}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  repairDb.enabled ? "bg-gray-900" : "bg-gray-300"
                }`}
                aria-label="Toggle repair database"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    repairDb.enabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-xs text-gray-500">
                {repairDb.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg border overflow-hidden transition-opacity ${
              repairDb.enabled ? "opacity-100" : "opacity-50 pointer-events-none"
            }`}
          >
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs text-gray-500">
                When enabled, Claude will call the{" "}
                <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                  lookup_repair_costs
                </code>{" "}
                tool during assessment and use these prices to generate a more
                accurate cost estimate.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide w-[40%]">
                      Part
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Min ($)
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Max ($)
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Labour (h)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {repairDb.entries.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-1.5">
                        <input
                          type="text"
                          value={entry.part}
                          onChange={(e) =>
                            updateEntry(i, { part: e.target.value })
                          }
                          className="w-full text-sm text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none py-0.5"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={entry.minCost}
                          onChange={(e) =>
                            updateEntry(i, {
                              minCost: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none py-0.5"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={entry.maxCost}
                          onChange={(e) =>
                            updateEntry(i, {
                              maxCost: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none py-0.5"
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={entry.laborHours}
                          onChange={(e) =>
                            updateEntry(i, {
                              laborHours: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none py-0.5"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-gray-900 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            {saved ? "Saved ✓" : "Save Settings"}
          </button>
        </div>
      </div>
    </main>
  );
}
