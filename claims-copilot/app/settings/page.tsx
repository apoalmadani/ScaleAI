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

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoredSettings>({
    activeId: "sonnet",
    strategies: BUILTIN_STRATEGIES,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

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

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b pb-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure assessment strategies and AI prompts
            </p>
          </div>
        </div>

        {/* Strategy list */}
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
                {/* Strategy header row */}
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="strategy"
                    checked={isActive}
                    onChange={() => setActive(strategy.id)}
                    className="mt-1 accent-gray-900 cursor-pointer"
                  />
                  <div className="flex-1 space-y-3">
                    {/* Name + type badge */}
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

                    {/* Manual: description only */}
                    {strategy.type === "manual" && (
                      <p className="text-xs text-gray-400">
                        Agent fills in all assessment fields manually — no AI
                        call is made.
                      </p>
                    )}

                    {/* AI: model selector + prompt editor */}
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
