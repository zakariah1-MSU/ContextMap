"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Download, FileUp, GitBranch, Moon, Network, Plus, RotateCw, Sun, Upload, X } from "lucide-react";
import { useContextStore } from "@/lib/store";
import type { Keyword } from "@/lib/schemas";
import { pathToNode } from "@/lib/graph";
import { HighlightedText } from "./HighlightedText";

const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false, loading: () => <div className="graph-placeholder">Mapping your learning path…</div> });
const sample = "This advanced artificial intelligence (AI) machine learning (ML) deep learning (DL) neural network (NN) model uses natural language processing (NLP), large language models (LLMs), and generative AI (GenAI) algorithms for data analytics, predictive modeling, cloud computing, and automated software engineering optimization.";

export function Workspace() {
  const { session, hydrated, busy, inputError, createSession, openConcept, selectNode, back, forward, setLevel, newSession, retry, importSession, setHydrated } = useContextStore();
  const [paste, setPaste] = useState(""); const [tab, setTab] = useState("reader"); const [light, setLight] = useState(false); const [message, setMessage] = useState(""); const [split, setSplit] = useState(58);
  const fileRef = useRef<HTMLInputElement>(null); const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!hydrated) setHydrated(); }, [hydrated, setHydrated]);
  useEffect(() => { const handle = (event: KeyboardEvent) => { if (!(event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight"))) return; if ((event.target as HTMLElement)?.matches("input,textarea,[contenteditable=true]")) return; event.preventDefault(); event.key === "ArrowLeft" ? back() : forward(); }; window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, [back, forward]);
  const current = session?.nodes[session.currentId];
  const ancestry = useMemo(() => session && current ? pathToNode(session, current.id) : [], [session, current]);
  const explored = useMemo(() => new Set(Object.values(session?.nodes || {}).filter((node) => node.kind === "concept").map((node) => node.term.toLocaleLowerCase())), [session]);
  const loading = useMemo(() => new Set(Object.values(session?.nodes || {}).filter((node) => node.status === "loading").map((node) => node.term.toLocaleLowerCase())), [session]);

  async function loadText(text: string) {
    const clipped = text.slice(0, 20_000);
    if (text.length > 20_000 && !window.confirm("This text is over 20,000 characters. Continue with the first 20,000 characters?")) return;
    await createSession(clipped);
  }
  async function onFile(file?: File) { if (!file) return; if (!/\.(txt|md)$/i.test(file.name)) { setMessage("Choose a .txt or .md file."); return; } const text = await file.text(); await loadText(text); }
  function exportJson() { if (!session) return; const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "contextmap-session"}.json`; anchor.click(); URL.revokeObjectURL(url); }
  async function importJson(file?: File) { if (!file) return; try { const value: unknown = JSON.parse(await file.text()); if (!importSession(value)) throw new Error(); setMessage("Session imported."); } catch { setMessage("That file is not a valid ContextMap session."); } }

  if (!hydrated) return <main className="boot-screen">Opening your workspace…</main>;
  if (!session) return <main className={`app-shell ${light ? "light" : ""}`}>
    <header className="topbar"><Brand /><div className="top-actions"><button className="icon-button" onClick={() => setLight(!light)} aria-label="Toggle theme">{light ? <Moon size={17} /> : <Sun size={17} />}</button></div></header>
    <section className="welcome-wrap"><div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-dot" /> A better way to follow your curiosity</div><h1>Keep the thread.<br /><em>Find the meaning.</em></h1><p>Bring an article. Open the ideas inside it. ContextMap turns every question into a lesson you can follow back to where it began.</p></div>
      <div className="upload-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void onFile(event.dataTransfer.files[0]); }}>
        <div className="upload-icon"><Upload size={21} /></div><h2>Start with something you’re reading</h2><p>Drop a text file here, paste an excerpt, or try the sample.</p>
        <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
        <button className="button-primary wide" onClick={() => fileRef.current?.click()}><FileUp size={16} /> Open a .txt or .md file</button>
        <div className="divider"><span>or paste text</span></div><textarea value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="Paste an article or a paragraph you want to understand…" rows={5} aria-label="Paste reading text" />
        <div className="upload-footer"><button className="text-button" onClick={() => void loadText(sample)}>Try a sample <ChevronRight size={14} /></button><button className="button-primary" disabled={!paste.trim() || busy} onClick={() => void loadText(paste)}>{busy ? "Finding key ideas…" : "Start reading"}</button></div>
        {inputError && <p className="error-text">{inputError}</p>}{message && <p className="error-text">{message}</p>}
      </div><div className="welcome-note"><BookOpen size={14} /> Sessions stay in this browser. Text is sent to your chosen model for lessons.</div>
    </section>
  </main>;

  return <main className={`app-shell workspace-shell ${light ? "light" : ""}`}>
    <header className="topbar"><Brand /><div className="session-name"><span className="session-kicker">YOUR READING MAP</span><strong>{session.title}</strong></div><div className="top-actions">
      <select value={session.level} onChange={(event) => setLevel(event.target.value as "beginner" | "intermediate" | "advanced")} aria-label="Learning level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
      <button className="toolbar-action" onClick={newSession}><Plus size={15} /> New</button><button className="icon-button" onClick={exportJson} aria-label="Export session"><Download size={16} /></button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importJson(event.target.files?.[0])} /><button className="icon-button" onClick={() => importRef.current?.click()} aria-label="Import session"><FileUp size={16} /></button><button className="icon-button" onClick={() => setLight(!light)} aria-label="Toggle theme">{light ? <Moon size={17} /> : <Sun size={17} />}</button>
    </div></header>
    <div className="mobile-tabs"><button className={tab === "reader" ? "active" : ""} onClick={() => setTab("reader")}><BookOpen size={15} /> Reader</button><button className={tab === "graph" ? "active" : ""} onClick={() => setTab("graph")}><Network size={15} /> Graph</button><button className={tab === "outline" ? "active" : ""} onClick={() => setTab("outline")}><GitBranch size={15} /> Outline</button></div>
    <div className="workspace-grid" style={{ gridTemplateColumns: `minmax(390px, ${split}fr) 8px minmax(320px, ${100 - split}fr)` }}>
      <section className={`reader-pane pane ${tab === "reader" ? "mobile-active" : "mobile-hidden"}`}>
        <div className="breadcrumb">{ancestry.map((term, index) => { const nodeId = index === 0 ? Object.keys(session.nodes).find((id) => session.nodes[id].kind === "document") : ancestry.slice(0, index + 1).reduce((parent, _) => { const child = Object.values(session.nodes).find((item) => item.term === term && item.firstParentId === parent); return child?.id || parent; }, Object.keys(session.nodes).find((id) => session.nodes[id].kind === "document") || ""); return <span key={`${term}-${index}`}><button className={index === ancestry.length - 1 ? "crumb-current" : ""} onClick={() => nodeId && selectNode(nodeId)}>{term}</button>{index < ancestry.length - 1 && <ChevronRight size={13} />}</span>; })}</div>
        <div className="lesson-heading"><div><span className="lesson-label">{current?.kind === "document" ? "SOURCE TEXT" : "CONCEPT LESSON"}</span><h1>{current?.term}</h1></div><div className="lesson-controls"><button className="icon-button" onClick={back} disabled={session.trailIndex <= 0} aria-label="Go back"><ArrowLeft size={16} /></button><button className="icon-button" onClick={forward} disabled={session.trailIndex >= session.trail.length - 1} aria-label="Go forward"><ArrowRight size={16} /></button>{current?.kind === "concept" && <button className="icon-button" onClick={() => void retry(current.id, true)} title="Regenerate lesson" aria-label="Regenerate lesson"><RotateCw size={15} /></button>}</div></div>
        {current?.status === "loading" ? <div className="lesson-loading"><p>Preparing your lesson on <strong>{current.term}</strong>…</p><i /><i /><i /><i /></div> : current?.status === "error" ? <div className="lesson-error"><div className="error-orb"><X size={16} /></div><p>{current.error}</p><button className="button-primary" onClick={() => void retry(current.id)}>Retry lesson</button></div> : current?.explanation && <>
          {current.kind === "concept" && <div className="context-callout"><span className="context-line" /><span>Following the thread from <strong>{ancestry.length > 1 ? ancestry.at(-2) : "your reading"}</strong></span></div>}
          <HighlightedText text={current.explanation} keywords={current.keywords} explored={explored} loading={loading} onSelect={(keyword, sentence) => void openConcept(keyword, sentence)} />
          {current.kind === "concept" && current.related.length > 0 && <div className="related-section"><div className="section-heading"><span>EXPLORE NEXT</span><span className="section-rule" /></div><div className="related-groups">{([ ["foundation", "Foundations", "↳"], ["sibling", "Related ideas", "◇"], ["deeper", "Go deeper", "↗"] ] as const).map(([relation, label, symbol]) => { const items = current.related.filter((item) => item.relation === relation); return items.length ? <div className="related-group" key={relation}><h3><span>{symbol}</span>{label}</h3><div className="chips">{items.map((item) => <button key={item.term} className="concept-chip" onClick={() => void openConcept({ text: item.term, canonical: item.term })}>{explored.has(item.term.toLocaleLowerCase()) && <Check size={12} />}{item.term}<ChevronRight size={12} /></button>)}</div></div> : null; })}</div></div>}
        </>}
        {current?.kind === "document" && <div className="document-hint"><span className="hint-icon"><Network size={15} /></span><span>Select an underlined idea to begin building your learning map.</span></div>}
      </section>
      <div className="resize-handle" role="separator" aria-label="Resize reader and graph" aria-orientation="vertical" aria-valuenow={split} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") setSplit((value) => Math.max(42, value - 3)); if (event.key === "ArrowRight") setSplit((value) => Math.min(68, value + 3)); }} onPointerDown={(event) => { const startX = event.clientX; const start = split; const width = event.currentTarget.parentElement?.getBoundingClientRect().width || window.innerWidth; event.currentTarget.setPointerCapture(event.pointerId); const move = (moveEvent: PointerEvent) => setSplit(Math.min(68, Math.max(42, start + ((moveEvent.clientX - startX) / width) * 100))); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true }); }} />
      <section className={`map-pane pane ${tab === "outline" ? "desktop-hidden" : ""} ${tab === "graph" ? "mobile-active" : "mobile-hidden"}`}><div className="map-topline"><div><div className="map-title"><span className="map-pulse" /> LEARNING MAP</div><p>{Object.keys(session.nodes).length - 1} {Object.keys(session.nodes).length === 2 ? "concept" : "concepts"} explored</p></div><div className="map-legend"><span><i className="legend-document" />Reading</span><span><i className="legend-concept" />Concept</span></div></div><GraphCanvas nodes={session.nodes} edges={session.edges} currentId={session.currentId} path={ancestry.map((term) => Object.values(session.nodes).find((node) => node.term === term)?.id || "")} onSelect={selectNode} /><div className="graph-footnote"><span>DRAG TO MOVE <b>·</b> SCROLL TO ZOOM <b>·</b> CLICK A NODE TO RETURN</span><button onClick={() => setTab("outline")}><GitBranch size={13} /> View outline</button></div></section>
      <section className={`outline-pane pane ${tab === "outline" ? "desktop-active mobile-active" : "mobile-hidden"}`}><div className="map-topline"><div><div className="map-title"><GitBranch size={15} /> CONCEPT OUTLINE</div><p>Your ideas, in the order you followed them</p></div></div><Outline session={session} onSelect={selectNode} /></section>
    </div>
    {message && <div className="toast" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss"><X size={14} /></button></div>}
  </main>;
}

function Brand() { return <div className="brand"><span className="brand-mark"><span /><span /><span /><span /></span><span>context<span>map</span></span></div>; }

function Outline({ session, onSelect }: { session: NonNullable<ReturnType<typeof useContextStore.getState>["session"]>; onSelect: (id: string) => void }) {
  const root = Object.values(session.nodes).find((node) => node.kind === "document"); if (!root) return null;
  const renderChildren = (parentId: string, depth: number): React.ReactNode => Object.values(session.nodes).filter((node) => node.firstParentId === parentId).map((node) => <div key={node.id}><button className={`outline-item ${session.currentId === node.id ? "selected" : ""}`} style={{ paddingLeft: `${20 + depth * 20}px` }} onClick={() => onSelect(node.id)}><span className={`outline-dot ${node.status}`} />{node.term}<span className="outline-state">{node.status === "loading" ? "…" : node.status === "error" ? "!" : ""}</span></button>{renderChildren(node.id, depth + 1)}</div>);
  return <div className="outline-list"><button className={`outline-item root ${session.currentId === root.id ? "selected" : ""}`} onClick={() => onSelect(root.id)}><span className="outline-dot document-dot" />{root.term}<span className="outline-state">SOURCE</span></button>{renderChildren(root.id, 0)}</div>;
}
