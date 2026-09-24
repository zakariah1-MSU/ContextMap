"use client";

import ForceGraph2D from "react-force-graph-2d";
import { useMemo, useRef, useState } from "react";
import type { ConceptNode, Edge } from "@/lib/graph";

export default function GraphCanvas({ nodes, edges, currentId, path, onSelect }: { nodes: Record<string, ConceptNode>; edges: Edge[]; currentId: string; path: string[]; onSelect: (id: string) => void }) {
  const graph = useRef<any>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const data = useMemo(() => ({ nodes: Object.values(nodes).map((node) => {
    const saved = positions.current.get(node.id); const parent = node.firstParentId ? positions.current.get(node.firstParentId) : undefined;
    return { ...node, x: saved?.x ?? parent?.x, y: saved?.y ?? parent?.y, val: node.kind === "document" ? 13 : 5 + (edges.filter((edge) => edge.source === node.id || edge.target === node.id).length * 1.3) };
  }), links: edges.map((edge) => ({ source: edge.source, target: edge.target })) }), [nodes, edges]);
  const pathEdges = new Set(path.slice(1).map((id, index) => [path[index], id].sort().join("::")));
  return <div className="graph-canvas">
    <ForceGraph2D ref={graph} graphData={data} backgroundColor="transparent" nodeId="id" linkSource="source" linkTarget="target" cooldownTicks={80} d3AlphaDecay={0.04} d3VelocityDecay={0.35} onNodeClick={(node: any) => onSelect(node.id)} onNodeHover={(node: any) => setHoveredId(node?.id ?? null)} onBackgroundClick={(event: MouseEvent) => { if (event.detail >= 2) graph.current?.zoomToFit(500, 70); }} onNodeDragEnd={(node: any) => { node.fx = node.x; node.fy = node.y; }}
      nodeCanvasObject={(node: any, ctx, scale) => {
        if (typeof node.x === "number" && typeof node.y === "number") positions.current.set(node.id, { x: node.x, y: node.y });
        const isCurrent = node.id === currentId; const isDocument = node.kind === "document"; const radius = Math.max(4, Math.sqrt(node.val) * (isDocument ? 2.2 : 1.8)) * (node.kind === "concept" ? Math.min(1, Math.max(.15, (Date.now() - node.createdAt) / 380)) : 1);
        const isNeighbor = data.links.some((link: any) => { const source = typeof link.source === "object" ? link.source.id : link.source; const target = typeof link.target === "object" ? link.target.id : link.target; return ((source === currentId && target === node.id) || (target === currentId && source === node.id) || (source === hoveredId && target === node.id) || (target === hoveredId && source === node.id)); });
        if (hoveredId && node.id !== hoveredId && !isNeighbor) ctx.globalAlpha = 0.22;
        ctx.beginPath(); ctx.arc(node.x, node.y, radius + (isCurrent ? 3 : 0), 0, 2 * Math.PI);
        ctx.fillStyle = node.status === "error" ? "#2b1823" : isDocument ? "#273046" : isCurrent ? "#8b5cf6" : "#282536"; ctx.fill();
        ctx.strokeStyle = node.status === "error" ? "#fb7185" : isCurrent ? "#c4b5fd" : isDocument ? "#7890c3" : "#655c7b"; ctx.lineWidth = isCurrent ? 2 : 1; ctx.stroke();
        if (node.status === "loading") { ctx.beginPath(); ctx.arc(node.x, node.y, radius + 5 + Math.sin(Date.now() / 180) * 2, 0, 2 * Math.PI); ctx.strokeStyle = "rgba(167,139,250,.55)"; ctx.stroke(); }
        const show = isCurrent || node.id === hoveredId || isNeighbor || scale > 1.35;
        if (show) { const label = String(node.term); ctx.font = `${isCurrent || node.id === hoveredId ? 12 : 10}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = isCurrent ? "#f3edff" : "#b5afc4"; ctx.fillText(label.length > 24 ? `${label.slice(0, 22)}…` : label, node.x, node.y + radius + 5); }
        ctx.globalAlpha = 1;
      }}
      linkColor={(link: any) => { const source = typeof link.source === "object" ? link.source.id : link.source; const target = typeof link.target === "object" ? link.target.id : link.target; const active = source === hoveredId || target === hoveredId; if (hoveredId && !active) return "rgba(139,132,160,.06)"; return pathEdges.has([source, target].sort().join("::")) ? "rgba(167,139,250,.85)" : active ? "rgba(167,139,250,.7)" : "rgba(139,132,160,.27)"; }}
      linkWidth={(link: any) => pathEdges.has([typeof link.source === "object" ? link.source.id : link.source, typeof link.target === "object" ? link.target.id : link.target].sort().join("::")) ? 2 : 1}
      />
    <button className="graph-fit" onClick={() => graph.current?.zoomToFit(600, 80)}>Fit graph</button>
    <button className="graph-center" onClick={() => { const node = data.nodes.find((item: any) => item.id === currentId) as any; if (node?.x != null) graph.current?.centerAt(node.x, node.y, 600); }}>Center current</button>
  </div>;
}
