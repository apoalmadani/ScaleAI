import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

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

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType, model, systemPrompt } = await req.json();

    if (!image || !mediaType) {
      return NextResponse.json(
        { error: "Missing image or mediaType" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt || SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: "text",
              text: "Assess the vehicle damage shown in this image.",
            },
          ],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const assessment = JSON.parse(stripCodeFences(rawText));

    if (assessment.not_a_vehicle) {
      return NextResponse.json({ error: assessment.message }, { status: 422 });
    }

    return NextResponse.json(assessment);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
