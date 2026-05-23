import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { lookupParts, RepairCostEntry, RepairDbSettings } from "@/lib/repairCosts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert auto-insurance damage assessor.

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

/**
 * Appended to the system prompt when the price database tool is enabled.
 * Instructs the model to call the tool before producing its final JSON.
 */
const TOOL_INSTRUCTIONS = `

You have access to a tool called lookup_repair_costs that queries the insurer's internal repair price database. When you identify damaged parts, you MUST call this tool with the complete list of damaged parts BEFORE generating your final JSON response. Use the returned cost ranges to calculate a precise estimated_cost_range (sum the min values for the low end, sum the max values for the high end). If a part is not found in the database, apply your own knowledge as a fallback for that part only.`;

const REPAIR_TOOL = {
  name: "lookup_repair_costs",
  description:
    "Query the insurer's internal repair price database for one or more vehicle parts. Returns min/max cost (USD) and estimated labour hours for each part. Use the results to compute the estimated_cost_range in your final assessment.",
  input_schema: {
    type: "object" as const,
    properties: {
      parts: {
        type: "array" as const,
        items: { type: "string" as const },
        description:
          'List of damaged part names to look up, e.g. ["front bumper", "hood", "windshield"]',
      },
    },
    required: ["parts"],
  },
};

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      image,
      mediaType,
      model,
      systemPrompt,
      repairDb,
    }: {
      image: string;
      mediaType: string;
      model?: string;
      systemPrompt?: string;
      repairDb?: RepairDbSettings;
    } = body;

    if (!image || !mediaType) {
      return NextResponse.json(
        { error: "Missing image or mediaType" },
        { status: 400 }
      );
    }

    const useModel = model || "claude-sonnet-4-6";
    const basePrompt = systemPrompt || SYSTEM_PROMPT;
    const useDb = repairDb?.enabled ? repairDb : null;

    // Append tool instructions when the price DB is active
    const systemFinal = useDb ? basePrompt + TOOL_INSTRUCTIONS : basePrompt;
    const tools = useDb ? [REPAIR_TOOL] : undefined;

    // Seed the conversation with the user's image
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: image,
            },
          },
          {
            type: "text",
            text: "Assess the vehicle damage shown in this image.",
          },
        ],
      },
    ];

    // Track which parts were looked up and their prices for the UI
    const consultedParts: string[] = [];
    const priceLookup: Record<string, unknown> = {};

    // ── Agentic loop (max 5 turns) ────────────────────────────────────────────
    for (let turn = 0; turn < 5; turn++) {
      const response = await client.messages.create({
        model: useModel,
        max_tokens: 1024,
        system: systemFinal,
        ...(tools ? { tools } : {}),
        messages,
      });

      // ── Model produced its final JSON ──────────────────────────────────────
      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        const rawText =
          textBlock && textBlock.type === "text" ? textBlock.text : "";

        const assessment = JSON.parse(stripCodeFences(rawText));

        if (assessment.not_a_vehicle) {
          return NextResponse.json(
            { error: assessment.message },
            { status: 422 }
          );
        }

        return NextResponse.json({
          ...assessment,
          ...(consultedParts.length > 0 && { consultedParts }),
          ...(Object.keys(priceLookup).length > 0 && { priceLookup }),
        });
      }

      // ── Model wants to call a tool ─────────────────────────────────────────
      if (response.stop_reason === "tool_use") {
        // Append the assistant turn (which contains tool_use blocks)
        messages.push({ role: "assistant", content: response.content });

        // Execute each tool call and build the result blocks
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          if (block.name === "lookup_repair_costs") {
            const input = block.input as { parts: string[] };
            const lookup = lookupParts(
              input.parts,
              (useDb as RepairDbSettings).entries as RepairCostEntry[]
            );

            for (const p of input.parts) {
              if (!consultedParts.includes(p)) consultedParts.push(p);
            }
            Object.assign(priceLookup, lookup);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(lookup),
            });
          }
        }

        // Feed the results back and continue
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Unexpected stop reason
      break;
    }

    return NextResponse.json(
      { error: "Assessment did not complete within the maximum number of turns" },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
