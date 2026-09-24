import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { explainRequestSchema, explainResponseSchema } from "@/lib/schemas";
import { asUntrustedTag, explanationSystem } from "@/lib/prompts";
import { rateLimited, requestKey } from "@/lib/rate-limit";
import { modelErrorDetails, modelErrorResponse } from "@/lib/model-errors";
import { generateStructured } from "@/lib/structured-generation";

export const runtime = "nodejs";
export const maxDuration = 30;
const outputSchema = z.object({
  explanation: z.string().min(1).max(3000),
  keywords: z.array(z.object({ text: z.string().min(1).max(120), canonical: z.string().min(1).max(120) })).max(14),
  related: z.array(z.object({ term: z.string().min(1).max(80), relation: z.enum(["foundation", "sibling", "deeper"]) })).max(10),
});
const normalized = (value: string) => value.trim().toLocaleLowerCase();

export async function POST(request: Request) {
  if (await rateLimited(`explain:${requestKey(request)}`)) return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  if (Number(request.headers.get("content-length") ?? 0) > 64_000) return NextResponse.json({ error: "The lesson request is too large." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  const parsed = explainRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "The lesson request is incomplete or exceeds its limits." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ error: "The lesson model is not configured yet. Add OPENAI_MODEL and OPENAI_API_KEY to .env.local." }, { status: 503 });

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const data = parsed.data;
  const explored = new Set(data.explored.map(normalized));
  try {
    let output: z.infer<typeof outputSchema> | undefined;
    let retryGuidance = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let object: z.infer<typeof outputSchema>;
      try { object = await generateStructured({
        model: openai(process.env.OPENAI_MODEL), system: explanationSystem, schema: outputSchema, maxOutputTokens: 1400,
        prompt: `<request>\n<term>${asUntrustedTag(data.term)}</term>\n<path>${data.path.map(asUntrustedTag).join(" → ")}</path>\n<source_sentence>${asUntrustedTag(data.sourceSentence ?? "")}</source_sentence>\n<document_excerpt>${asUntrustedTag(data.documentExcerpt ?? "")}</document_excerpt>\n<level>${data.level}</level>\n<already_explored>${data.explored.slice(0, 40).map(asUntrustedTag).join(", ")}</already_explored>\n</request>\n${attempt ? `Rewrite the lesson to fix these specific validation issues: ${retryGuidance} The explanation must be 130-200 words. Include at least six keyword entries whose text appears verbatim in the explanation. Related concepts are optional, up to 10; include only eligible, distinct concepts.` : "Generate the lesson now. The explanation must be 130-200 words. Include at least six keyword entries whose text appears verbatim in the explanation. Related concepts are optional, up to 10; include only eligible, distinct concepts."}`,
      }); } catch (error) { if (attempt === 1) throw error; continue; }
      const keywords = object.keywords.filter((item) => normalized(item.text) !== normalized(data.term) && data.term.toLocaleLowerCase() !== item.canonical.toLocaleLowerCase() && object.explanation.toLocaleLowerCase().includes(item.text.toLocaleLowerCase())).filter((item, index, all) => all.findIndex((other) => normalized(other.text) === normalized(item.text)) === index).slice(0, 14);
      const related = object.related.filter((item) => normalized(item.term) !== normalized(data.term) && !explored.has(normalized(item.term))).filter((item, index, all) => all.findIndex((other) => normalized(other.term) === normalized(item.term)) === index).slice(0, 10);
      output = { ...object, keywords, related };
      const wordCount = output.explanation.trim().split(/\s+/).length;
      const issues: string[] = [];
      if (wordCount < 130) issues.push(`the explanation has ${wordCount} words, fewer than 130`);
      if (wordCount > 200) issues.push(`the explanation has ${wordCount} words, more than 200`);
      if (keywords.length < 6) issues.push(`only ${keywords.length} usable keywords remain after validation, fewer than six`);
      retryGuidance = issues.join("; ");
      if (issues.length === 0 || attempt === 1) break;
    }
    const finalWords = output?.explanation.trim().split(/\s+/).length ?? 0;
    if (!output) return NextResponse.json({ error: "We couldn't prepare this lesson. Please retry." }, { status: 502 });
    if (finalWords < 130 || finalWords > 200 || output.keywords.length < 6) {
      console.warn("[explain] returning valid lesson that missed quality targets", { wordCount: finalWords, usableKeywordCount: output.keywords.length });
    }
    return NextResponse.json(explainResponseSchema.parse(output));
  } catch (error) {
    console.error("[explain] model request failed", modelErrorDetails(error));
    const failure = modelErrorResponse(error, "We couldn't prepare this lesson. Please retry in a moment.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
