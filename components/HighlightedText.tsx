"use client";

import type { Keyword } from "@/lib/schemas";
import { sentenceAt, splitHighlightedText } from "@/lib/highlight";

export function HighlightedText({ text, keywords, explored, loading, onSelect }: { text: string; keywords: Keyword[]; explored: Set<string>; loading: Set<string>; onSelect: (keyword: Keyword, sentence: string) => void }) {
  const paragraphs = text.split(/\n\s*\n/);
  return <div className="reading-copy">{paragraphs.map((paragraph, paragraphIndex) => {
    let cursor = 0;
    return <p key={`${paragraphIndex}-${paragraph.slice(0, 12)}`}>{splitHighlightedText(paragraph, keywords).map((part, index) => {
      const start = cursor; cursor += part.text.length;
      if (!part.keyword) return <span key={index}>{part.text}</span>;
      const id = part.keyword.canonical.toLocaleLowerCase();
      const isExplored = explored.has(id); const isLoading = loading.has(id);
      return <button key={`${index}-${part.keyword.text}`} type="button" className={`keyword ${isExplored ? "keyword-explored" : ""} ${isLoading ? "keyword-loading" : ""}`} aria-label={`Explain ${part.keyword.text}`} onClick={() => onSelect(part.keyword!, sentenceAt(paragraph, start))}>{part.text}{isExplored && <span className="explored-dot" aria-hidden="true" />}</button>;
    })}</p>;
  })}</div>;
}
