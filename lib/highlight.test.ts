import { describe, expect, it } from "vitest";
import { sentenceAt, splitHighlightedText } from "./highlight";

const terms = (...values: string[]) => values.map((text) => ({ text, canonical: text }));
const matches = (text: string, list: ReturnType<typeof terms>) => splitHighlightedText(text, list).filter((part) => part.keyword).map((part) => part.text);

describe("splitHighlightedText", () => {
  it("prefers the longest overlapping term", () => expect(matches("machine learning model", terms("machine", "machine learning"))).toEqual(["machine learning"]));
  it("matches without case sensitivity", () => expect(matches("AI and ai", terms("AI"))).toEqual(["AI", "ai"]));
  it("handles a term next to parentheses", () => expect(matches("(ML)", terms("ML"))).toEqual(["ML"]));
  it("escapes regex punctuation", () => expect(matches("C++ and C", terms("C++"))).toEqual(["C++"]));
  it("handles Unicode words", () => expect(matches("über model", terms("über"))).toEqual(["über"]));
  it("matches at paragraph boundaries but not inside a word", () => expect(matches("AI maintain AI", terms("AI"))).toEqual(["AI", "AI"]));
  it("matches terms at the start and end of text", () => expect(matches("ML then NLP", terms("ML", "NLP"))).toEqual(["ML", "NLP"]));
});

describe("sentenceAt", () => {
  it("returns the containing sentence", () => expect(sentenceAt("First sentence. Here is machine learning! Last?", 25)).toBe("Here is machine learning!"));
  it("does not cross paragraph boundaries", () => expect(sentenceAt("Term here\nAnother thought", 2)).toBe("Term here"));
});
