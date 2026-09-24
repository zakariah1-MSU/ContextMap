import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Keyword, Level, Related } from "./schemas";
import { addEdge, nodeIdForCanonical, pathToNode, type ConceptNode, type Session } from "./graph";

type LessonResult = { explanation: string; keywords: Keyword[]; related: Related[] };
type State = {
  session: Session | null;
  hydrated: boolean;
  busy: boolean;
  inputError?: string;
  createSession: (text: string) => Promise<void>;
  openConcept: (keyword: Keyword, sourceSentence?: string) => Promise<void>;
  selectNode: (id: string) => void;
  back: () => void;
  forward: () => void;
  setLevel: (level: Level) => void;
  newSession: () => void;
  retry: (id?: string, regenerate?: boolean) => Promise<void>;
  importSession: (value: unknown) => boolean;
  setHydrated: () => void;
};

let latestSession = "";
let runtimeEpoch = 0;
const requestGenerations = new Map<string, number>();
function beginNodeRequest(sessionId: string, nodeId: string) {
  const key = `${runtimeEpoch}:${sessionId}:${nodeId}`;
  const generation = (requestGenerations.get(key) ?? 0) + 1;
  requestGenerations.set(key, generation);
  return { key, generation, epoch: runtimeEpoch };
}
function isCurrentRequest(request: ReturnType<typeof beginNodeRequest>) {
  return request.epoch === runtimeEpoch && requestGenerations.get(request.key) === request.generation;
}
const empty = (session: Session): Session => ({ ...session, trail: [session.currentId], trailIndex: 0 });

async function requestLesson(session: Session, nodeId: string, sourceSentence = ""): Promise<LessonResult> {
  const path = pathToNode(session, nodeId);
  const explored = Object.values(session.nodes).filter((node) => node.kind === "concept" && node.id !== nodeId).map((node) => node.term).slice(0, 40);
  const root = Object.values(session.nodes).find((node) => node.kind === "document");
  const response = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ term: session.nodes[nodeId].term, path, sourceSentence: sourceSentence || session.nodes[nodeId].sourceSentence, documentExcerpt: root?.explanation?.slice(0, 600), explored, level: session.level }) });
  const result = await response.json() as LessonResult & { error?: string };
  if (!response.ok) throw new Error(result.error || "Unable to load this lesson.");
  return result;
}

function validateSession(input: unknown): Session | null {
  try {
    const value = input as Session;
    if (!value || typeof value !== "object" || typeof value.id !== "string" || value.id.length > 100 || typeof value.title !== "string" || value.title.length > 120 || !value.nodes || typeof value.nodes !== "object" || !Array.isArray(value.edges) || !Array.isArray(value.trail)) return null;
    const entries = Object.entries(value.nodes);
    if (entries.length < 1 || entries.length > 500 || value.edges.length > 1_000 || value.trail.length < 1 || value.trail.length > 1_000 || !["beginner", "intermediate", "advanced"].includes(value.level)) return null;
    const ids = new Set(entries.map(([id]) => id));
    if (!ids.has(value.currentId) || value.edges.some((edge) => !edge || !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target)) return null;
    if (value.trail.some((id) => !ids.has(id))) return null;
    const roots = entries.filter(([, node]) => node?.kind === "document");
    if (roots.length !== 1) return null;
    const rootId = roots[0][0];
    for (const [id, node] of entries) {
      if (!node || node.id !== id || typeof node.term !== "string" || node.term.length > 120 || !["document", "concept"].includes(node.kind) || !["ready", "loading", "error"].includes(node.status) || !Array.isArray(node.keywords) || !Array.isArray(node.related) || !Number.isFinite(node.createdAt)) return null;
      const maxExplanation = node.kind === "document" ? 20_000 : 3_000;
      if (node.explanation !== undefined && (typeof node.explanation !== "string" || node.explanation.length > maxExplanation)) return null;
      if (node.keywords.length > 40 || node.keywords.some((keyword) => !keyword || typeof keyword.text !== "string" || !keyword.text || keyword.text.length > 120 || typeof keyword.canonical !== "string" || !keyword.canonical || keyword.canonical.length > 120)) return null;
      if (node.related.length > 10 || node.related.some((related) => !related || typeof related.term !== "string" || !related.term || related.term.length > 80 || !["foundation", "sibling", "deeper"].includes(related.relation))) return null;
      if (node.kind === "document" ? id !== rootId || node.firstParentId !== undefined : !node.firstParentId || !ids.has(node.firstParentId)) return null;
      if (node.sourceSentence !== undefined && (typeof node.sourceSentence !== "string" || node.sourceSentence.length > 1200)) return null;
    }
    for (const [id, node] of entries) {
      if (node.kind === "document") continue;
      const seen = new Set<string>(); let parent = node;
      while (parent.kind !== "document") {
        if (seen.has(parent.id) || !parent.firstParentId) return null;
        seen.add(parent.id);
        const next = value.nodes[parent.firstParentId];
        if (!next) return null;
        parent = next;
      }
      if (parent.id !== rootId) return null;
    }
    const nodes = Object.fromEntries(entries.map(([id, node]) => [id, node.status === "loading" ? { ...node, status: "error", error: "This lesson was interrupted before the page closed. Retry to continue." } : node])) as Record<string, ConceptNode>;
    return { ...value, nodes, trailIndex: Math.min(Math.max(0, Number(value.trailIndex) || 0), value.trail.length - 1) };
  } catch { return null; }
}

export const useContextStore = create<State>()(persist((set, get) => ({
  session: null, hydrated: false, busy: false,
  setHydrated: () => set({ hydrated: true }),
  createSession: async (text) => {
    runtimeEpoch += 1;
    const epoch = runtimeEpoch;
    latestSession = crypto.randomUUID();
    const requestId = latestSession;
    set({ busy: true, inputError: undefined });
    try {
      const response = await fetch("/api/extract-keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const result = await response.json() as { title?: string; keywords?: Keyword[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not read this text.");
      if (latestSession !== requestId || runtimeEpoch !== epoch) return;
      const id = `document-${requestId.slice(0, 8)}`;
      const document: ConceptNode = { id, term: result.title || "Your reading", kind: "document", explanation: text.slice(0, 20_000), keywords: result.keywords || [], related: [], status: "ready", createdAt: Date.now() };
      set({ session: empty({ id: requestId, title: document.term, level: "beginner", nodes: { [id]: document }, edges: [], currentId: id, trail: [id], trailIndex: 0 }), busy: false });
    } catch (error) { if (latestSession === requestId && runtimeEpoch === epoch) set({ busy: false, inputError: error instanceof Error ? error.message : "Could not read this text." }); }
  },
  openConcept: async (keyword, sourceSentence) => {
    const current = get().session;
    if (!current) return;
    const id = nodeIdForCanonical(current.nodes, keyword.canonical);
    const existing = current.nodes[id];
    const node: ConceptNode = existing || { id, term: keyword.canonical.trim(), kind: "concept", keywords: [], related: [], firstParentId: current.currentId, sourceSentence: (sourceSentence || "").slice(0, 1200), status: "loading", createdAt: Date.now() };
    const trail = current.trail.slice(0, current.trailIndex + 1);
    const updated = { ...current, nodes: existing ? current.nodes : { ...current.nodes, [id]: node }, edges: addEdge(current.edges, current.currentId, id), currentId: id, trail: trail.at(-1) === id ? trail : [...trail, id], trailIndex: trail.at(-1) === id ? trail.length - 1 : trail.length };
    set({ session: updated });
    if (existing) return;
    const owningSession = current.id;
    const requestGeneration = beginNodeRequest(owningSession, id);
    try {
      const lesson = await requestLesson(updated, id, sourceSentence);
      if (get().session?.id !== owningSession || !isCurrentRequest(requestGeneration)) return;
      set((state) => {
        if (state.session?.id !== owningSession) return {};
        return { session: { ...state.session, nodes: { ...state.session.nodes, [id]: { ...state.session.nodes[id], ...lesson, status: "ready", error: undefined } } } };
      });
    } catch (error) {
      if (get().session?.id !== owningSession || !isCurrentRequest(requestGeneration)) return;
      set((state) => {
        if (state.session?.id !== owningSession) return {};
        return { session: { ...state.session, nodes: { ...state.session.nodes, [id]: { ...state.session.nodes[id], status: "error", error: error instanceof Error ? error.message : "Unable to load this lesson." } } } };
      });
    }
  },
  selectNode: (id) => set((state) => {
    if (!state.session?.nodes[id]) return {};
    const trail = state.session.trail.slice(0, state.session.trailIndex + 1);
    if (trail.at(-1) === id) return { session: { ...state.session, currentId: id } };
    const next = [...trail, id]; return { session: { ...state.session, currentId: id, trail: next, trailIndex: next.length - 1 } };
  }),
  back: () => set((state) => { if (!state.session || state.session.trailIndex <= 0) return {}; const index = state.session.trailIndex - 1; return { session: { ...state.session, trailIndex: index, currentId: state.session.trail[index] } }; }),
  forward: () => set((state) => { if (!state.session || state.session.trailIndex >= state.session.trail.length - 1) return {}; const index = state.session.trailIndex + 1; return { session: { ...state.session, trailIndex: index, currentId: state.session.trail[index] } }; }),
  setLevel: (level) => set((state) => state.session ? { session: { ...state.session, level } } : {}),
  newSession: () => { runtimeEpoch += 1; latestSession = crypto.randomUUID(); set({ session: null, inputError: undefined, busy: false }); },
  retry: async (targetId, regenerate = false) => {
    const current = get().session; if (!current) return;
    const id = targetId || current.currentId; const node = current.nodes[id]; if (!node || node.kind !== "concept" || (node.status !== "error" && !regenerate)) return;
    const owningSession = current.id;
    const requestGeneration = beginNodeRequest(owningSession, id);
    set({ session: { ...current, nodes: { ...current.nodes, [id]: { ...node, status: "loading", error: undefined } } } });
    try {
      const lesson = await requestLesson(current, id);
      if (get().session?.id !== owningSession || !isCurrentRequest(requestGeneration)) return;
      set((state) => {
        if (state.session?.id !== owningSession) return {};
        return { session: { ...state.session, nodes: { ...state.session.nodes, [id]: { ...state.session.nodes[id], ...lesson, status: "ready", error: undefined } } } };
      });
    } catch (error) {
      if (get().session?.id === owningSession && isCurrentRequest(requestGeneration)) set((state) => state.session ? { session: { ...state.session, nodes: { ...state.session.nodes, [id]: { ...state.session.nodes[id], status: "error", error: error instanceof Error ? error.message : "Unable to load this lesson." } } } } : {});
    }
  },
  importSession: (input) => { const session = validateSession(input); if (!session) return false; runtimeEpoch += 1; latestSession = session.id; set({ session }); return true; },
}), {
  name: "contextmap-session-v1", version: 1, storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ session: state.session }) as State,
  onRehydrateStorage: () => (state) => { state?.setHydrated(); },
  merge: (persisted, current) => { const stored = (persisted as { session?: unknown } | undefined)?.session; return { ...current, session: stored ? validateSession(stored) : null }; },
}));
