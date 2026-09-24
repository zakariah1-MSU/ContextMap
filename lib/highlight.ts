import type { Keyword } from "./schemas";

export type TextPart = { text: string; keyword?: Keyword };
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function splitHighlightedText(text: string, keywords: Keyword[]): TextPart[] {
  const byText = new Map<string, Keyword>();
  for (const keyword of keywords) if (keyword.text.trim()) byText.set(keyword.text.toLocaleLowerCase(), keyword);
  const terms = [...byText.values()].sort((a, b) => b.text.length - a.text.length);
  if (!terms.length) return [{ text }];
  const pattern = terms.map((term) => escapeRegex(term.text)).join("|");
  let matcher: RegExp; let usesPrefix = false;
  try { matcher = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, "giu"); }
  catch { matcher = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`, "giu"); usesPrefix = true; }
  const lookup = new Map(terms.map((term) => [term.text.toLocaleLowerCase(), term]));
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(matcher)) {
    const prefix = usesPrefix ? match[1] ?? "" : "";
    const value = usesPrefix ? match[2] ?? "" : match[0];
    const index = (match.index ?? 0) + prefix.length;
    if (index > cursor) parts.push({ text: text.slice(cursor, index) });
    const keyword = lookup.get(value.toLocaleLowerCase());
    if (keyword) parts.push({ text: value, keyword });
    cursor = index + value.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts.length ? parts : [{ text }];
}

export function sentenceAt(text: string, index: number): string {
  const startBoundary = Math.max(text.lastIndexOf(".", index - 1), text.lastIndexOf("!", index - 1), text.lastIndexOf("?", index - 1), text.lastIndexOf("\n", index - 1)) + 1;
  const ends = [".", "!", "?", "\n"].map((char) => { const found = text.indexOf(char, index); return found < 0 ? text.length : found + 1; });
  const end = Math.min(...ends);
  return text.slice(startBoundary, end).trim();
}
