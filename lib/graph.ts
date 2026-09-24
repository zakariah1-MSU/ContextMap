import type { Keyword } from "./schemas";

export type ConceptNode = {
  id: string; term: string; kind: "document" | "concept"; explanation?: string; keywords: Keyword[];
  related: { term: string; relation: "foundation" | "sibling" | "deeper" }[];
  firstParentId?: string; sourceSentence?: string; status: "loading" | "ready" | "error"; error?: string; createdAt: number;
};
export type Edge = { source: string; target: string };
export type Session = { id: string; title: string; level: "beginner" | "intermediate" | "advanced"; nodes: Record<string, ConceptNode>; edges: Edge[]; currentId: string; trail: string[]; trailIndex: number };

export function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "concept";
}
export function edgeKey(a: string, b: string): string { return [a, b].sort().join("::"); }
export function addEdge(edges: Edge[], a: string, b: string): Edge[] {
  if (a === b || edges.some((edge) => edgeKey(edge.source, edge.target) === edgeKey(a, b))) return edges;
  return [...edges, { source: a, target: b }];
}
export function pathToNode(session: Session, id: string): string[] {
  const path: string[] = []; const seen = new Set<string>(); let node: ConceptNode | undefined = session.nodes[id];
  while (node && !seen.has(node.id)) { seen.add(node.id); path.push(node.term); node = node.firstParentId ? session.nodes[node.firstParentId] : undefined; }
  return path.reverse();
}
export function nodeIdForCanonical(nodes: Record<string, ConceptNode>, canonical: string): string {
  const base = slugify(canonical);
  if (!nodes[base] || nodes[base].term.toLocaleLowerCase() === canonical.toLocaleLowerCase()) return base;
  return `${base}-${Array.from(canonical).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 7).toString(36)}`;
}
