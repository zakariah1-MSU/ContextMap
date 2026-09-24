import { z } from "zod";

export const keywordSchema = z.object({ text: z.string().min(1).max(120), canonical: z.string().min(1).max(120) });
export const relatedSchema = z.object({ term: z.string().min(1).max(80), relation: z.enum(["foundation", "sibling", "deeper"]) });
export const levelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const extractRequestSchema = z.object({ text: z.string().trim().min(1).max(20_000) });
export const extractResponseSchema = z.object({ title: z.string().min(1).max(80), keywords: z.array(keywordSchema).max(40) });
export const explainRequestSchema = z.object({
  term: z.string().trim().min(1).max(100), path: z.array(z.string().max(120)).max(20),
  sourceSentence: z.string().max(1200).optional(), documentExcerpt: z.string().max(600).optional(),
  explored: z.array(z.string().max(120)).max(40), level: levelSchema,
});
export const explainResponseSchema = z.object({ explanation: z.string().min(1).max(3000), keywords: z.array(keywordSchema).max(14), related: z.array(relatedSchema).max(10) });

export type Keyword = z.infer<typeof keywordSchema>;
export type Related = z.infer<typeof relatedSchema>;
export type Level = z.infer<typeof levelSchema>;
