import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import type { z } from "zod";

/** Request schema-constrained output and validate it locally with Zod. */
export async function generateStructured<Schema extends z.ZodTypeAny>(options: {
  model: LanguageModel;
  system: string;
  prompt: string;
  schema: Schema;
  maxOutputTokens: number;
}) {
  const result = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    output: Output.object({ schema: options.schema }),
    temperature: 0.3,
    reasoning: "minimal",
    maxOutputTokens: options.maxOutputTokens,
    maxRetries: 0,
    timeout: { totalMs: 12_000 },
  });
  if (!result.output) throw new Error("The model did not return the required structured output.");
  return options.schema.parse(result.output) as z.infer<Schema>;
}
