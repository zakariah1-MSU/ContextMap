import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractRequestSchema, extractResponseSchema } from "@/lib/schemas";
import { asUntrustedTag, extractionSystem } from "@/lib/prompts";
import { rateLimited, requestKey } from "@/lib/rate-limit";
import { modelErrorDetails, modelErrorResponse } from "@/lib/model-errors";
import { generateStructured } from "@/lib/structured-generation";

export const runtime = "nodejs";
export const maxDuration = 30;
const outputSchema = z.object({ title: z.string().min(1).max(80), keywords: z.array(z.object({ text: z.string().min(1).max(120), canonical: z.string().min(1).max(120) })).max(40) });

export async function POST(request: Request) {
  if (await rateLimited(`extract:${requestKey(request)}`)) return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  if (Number(request.headers.get("content-length") ?? 0) > 160_000) return NextResponse.json({ error: "The request is too large. Text is limited to 20,000 characters." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  const parsed = extractRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Text is required and must be 1–20,000 characters." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ error: "The lesson model is not configured yet. Add OPENAI_MODEL and OPENAI_API_KEY to .env.local." }, { status: 503 });
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    let result: z.infer<typeof outputSchema> | undefined;
    let providerError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await generateStructured({ model: openai(process.env.OPENAI_MODEL), system: extractionSystem, schema: outputSchema, maxOutputTokens: 1500, prompt: `<text>\n${asUntrustedTag(parsed.data.text)}\n</text>\n${attempt ? "Correct the prior result. Every keyword text must be an exact substring of the tagged text." : "Return a title and terms that occur in this text."}` });
        if (result.keywords.every((item) => parsed.data.text.includes(item.text))) break;
        result = undefined;
        providerError = undefined;
      } catch (error) { providerError = error; if (attempt === 1) break; }
    }
    if (!result && providerError) {
      console.error("[extract-keywords] model request failed", modelErrorDetails(providerError));
      const failure = modelErrorResponse(providerError, "We couldn't identify terms right now. Please try again.");
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    if (!result) return NextResponse.json({ error: "The model returned terms that were not in the text. Please try again." }, { status: 502 });
    const seen = new Set<string>();
    const keywords = result.keywords.filter((item) => { const key = item.text.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return parsed.data.text.includes(item.text); }).sort((a, b) => parsed.data.text.indexOf(a.text) - parsed.data.text.indexOf(b.text)).slice(0, 40);
    const response = extractResponseSchema.parse({ title: result.title.split(/\s+/).slice(0, 6).join(" "), keywords });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[extract-keywords] response processing failed", modelErrorDetails(error));
    const failure = modelErrorResponse(error, "We couldn't identify terms right now. Please try again.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
