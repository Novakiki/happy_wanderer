'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';

const EDGE_FILTERS = [
  { key: 'reference', label: 'References', color: 'rgba(255, 255, 255, 0.6)' },
  { key: 'chain', label: 'Sparked-by', color: 'rgba(129, 178, 154, 0.8)' },
  { key: 'thread', label: 'Threads', color: 'rgba(224, 122, 95, 0.8)' },
] as const;

type EdgeFilterKey = (typeof EDGE_FILTERS)[number]['key'];
type EdgeFilterState = Record<EdgeFilterKey, boolean>;

const DEFAULT_EDGE_FILTERS: EdgeFilterState = {
  reference: true,
  chain: true,
  thread: true,
};

type GraphNode = {
  id: string;
  label: string;
  type: 'person' | 'event';
  size: number;
  color: string;
  metadata?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'reference' | 'thread' | 'chain';
  label?: string;
  color: string;
  role?: string | null;
  relationship?: string | null;
  visibility?: string | null;
  year?: number | null;
};

type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type HoveredNode = {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
} | null;

export default function GraphVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const hoveredNodeRef = useRef<HoveredNode>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, people: 0, events: 0 });
  const [edgeFilters, setEdgeFilters] = useState<EdgeFilterState>(() => ({ ...DEFAULT_EDGE_FILTERS }));

  const applyEdgeFilters = useCallback((graph: Graph, filters: EdgeFilterState) => {
    let visibleEdges = 0;

    graph.forEachEdge((edge, attrs) => {
      const kind = (attrs.kind ?? 'reference') as EdgeFilterKey;
      const shouldShow = filters[kind] ?? true;
      graph.setEdgeAttribute(edge, 'hidden', !shouldShow);
      if (shouldShow) {
        visibleEdges += 1;
      }
    });

    let people = 0;
    let events = 0;
    let nodes = 0;

    graph.forEachNode((node, attrs) => {
      const hasVisibleEdge = graph.edges(node).some((edge) => !graph.getEdgeAttribute(edge, 'hidden'));
      graph.setNodeAttribute(node, 'hidden', !hasVisibleEdge);
      if (!hasVisibleEdge) return;

      nodes += 1;
      const kind = attrs.kind as string | undefined;
      if (kind === 'person') {
        people += 1;
      } else if (kind === 'event') {
        events += 1;
      }
    });

    setStats({ nodes, edges: visibleEdges, people, events });
    setEmptyMessage(visibleEdges === 0 ? 'No connections to show yet.' : null);
    sigmaRef.current?.refresh();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const initGraph = async () => {
      try {
        // Fetch graph data
        const response = await fetch('/api/graph');
        if (!response.ok) throw new Error('Failed to fetch graph data');

        const data: GraphData = await response.json();

        if (data.nodes.length === 0) {
          setError('No data to visualize yet. Add some notes first.');
          setLoading(false);
          return;
        }

        setHasData(true);

        // Create graphology instance
        const graph = new Graph();

        // Add nodes
        for (const node of data.nodes) {
          const metadata = { ...(node.metadata ?? {}) } as Record<string, unknown>;
          delete (metadata as { type?: unknown }).type;
          graph.addNode(node.id, {
            label: node.label,
            size: node.size,
            color: node.color,
            kind: node.type,
            ...metadata,
            type: 'circle',
          });
        }

        // Add edges
        for (const edge of data.edges) {
          if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
            try {
              graph.addEdge(edge.source, edge.target, {
                color: edge.color,
                size: 1,
                kind: edge.type,
                label: edge.label,
                type: edge.type === 'chain' ? 'arrow' : 'line',
              });
            } catch {
              // Edge may already exist
            }
          }
        }

        try {
          // Apply initial circular layout
          circular.assign(graph);
        } catch (layoutError) {
          console.warn('Graph circular layout failed:', layoutError);
        }

        try {
          // Apply force-directed layout
          const settings = forceAtlas2.inferSettings(graph);
          forceAtlas2.assign(graph, {
            iterations: 100,
            settings: {
              ...settings,
              gravity: 1,
              scalingRatio: 10,
            },
          });
        } catch (layoutError) {
          console.warn('Graph force layout failed:', layoutError);
        }

        graphRef.current = graph;

        // Create Sigma instance
        try {
          if (sigmaRef.current) {
            sigmaRef.current.kill();
          }

          const sigma = new Sigma(graph, containerRef.current!, {
            renderEdgeLabels: false,
            defaultNodeColor: '#999',
            defaultEdgeColor: 'rgba(255,255,255,0.1)',
            labelColor: { color: '#fff' },
            labelFont: 'Sora, system-ui, sans-serif',
            labelSize: 12,
            labelWeight: '500',
            stagePadding: 50,
            enableCameraZooming: true,
            zoomingRatio: 1.2,
            doubleClickZoomingRatio: 1.2,
            nodeReducer: (node, data) => {
              const res = { ...data };
              if (res.hidden) return res;
              const hovered = hoveredNodeRef.current;
              if (hovered && hovered.id !== node) {
                // Check if connected to hovered node
                const sharedEdges = graph.edges(hovered.id, node);
                const isConnected = sharedEdges.some((edge) => !graph.getEdgeAttribute(edge, 'hidden'));
                if (!isConnected) {
                  res.color = 'rgba(100,100,100,0.3)';
                  res.label = '';
                }
              }
              return res;
            },
            edgeReducer: (edge, data) => {
              const res = { ...data };
              if (res.hidden) return res;
              const hovered = hoveredNodeRef.current;
              if (hovered) {
                const [source, target] = graph.extremities(edge);
                if (source !== hovered.id && target !== hovered.id) {
                  res.color = 'rgba(100,100,100,0.1)';
                }
              }
              return res;
            },
          });

          // Allow page scroll when hovering; hold Cmd/Ctrl to zoom the graph
          const mouseCaptor = sigma.getMouseCaptor();
          mouseCaptor.on('wheel', (e) => {
            // If user holds Cmd/Ctrl (or pinch zoom triggers ctrlKey), allow Sigma zoom
            if (e.original.ctrlKey || e.original.metaKey) return;
            // Otherwise, scroll the page instead of zooming the graph
            e.preventSigmaDefault?.();
            e.original.preventDefault();
            e.original.stopPropagation();
            if ('deltaY' in e.original) {
              const wheelEvent = e.original as WheelEvent;
              window.scrollBy({ top: wheelEvent.deltaY, left: wheelEvent.deltaX, behavior: 'auto' });
            }
          });

          // Event handlers
          sigma.on('enterNode', ({ node }) => {
            const attrs = graph.getNodeAttributes(node);
            const nodeKind = attrs.kind as string | undefined;
            const nextHovered = {
              id: node,
              label: attrs.label as string,
              type: nodeKind || 'node',
              metadata: attrs as Record<string, unknown>,
            };
            hoveredNodeRef.current = nextHovered;
            setHoveredNode(nextHovered);
          });

          sigma.on('leaveNode', () => {
            hoveredNodeRef.current = null;
            setHoveredNode(null);
          });

          sigmaRef.current = sigma;

          applyEdgeFilters(graph, DEFAULT_EDGE_FILTERS);
        } catch (renderError) {
          console.error('Graph renderer error:', renderError);
          setError('Graph renderer unavailable');
        }

        setLoading(false);
      } catch (err) {
        console.error('Graph initialization error:', err);
        setError('Failed to load graph visualization');
        setLoading(false);
      }
    };

    initGraph();

    return () => {
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
      graphRef.current = null;
    };
  }, [applyEdgeFilters]);

  useEffect(() => {
    if (!graphRef.current) return;
    applyEdgeFilters(graphRef.current, edgeFilters);
  }, [applyEdgeFilters, edgeFilters]);

  // Update sigma when hoveredNode changes
  useEffect(() => {
    if (sigmaRef.current) {
      sigmaRef.current.refresh();
    }
  }, [hoveredNode]);

  const overlayMessage = loading ? 'Loading graph...' : error || emptyMessage;

  return (
    <div className="relative">
      {/* Graph container */}
      <div
        ref={containerRef}
        className="h-[600px] w-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl"
        style={{ cursor: 'grab' }}
      />

      {overlayMessage && (
        <div className="absolute inset-0 z-0 flex items-center justify-center rounded-2xl bg-black/40 text-white/60">
          {overlayMessage}
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* Stats bar */}
          <div className="absolute top-4 left-4 z-10 space-y-3">
            <div className="flex gap-4 text-sm">
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur text-white/80">
                <span className="text-[#e07a5f]">{stats.people}</span> people
              </div>
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur text-white/80">
                <span className="text-[#3d405b]">{stats.events}</span> events
              </div>
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur text-white/80">
                <span className="text-white/60">{stats.edges}</span> connections
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs text-white/50">
              <span>Edge types</span>
              <div className="flex flex-wrap gap-2">
              {EDGE_FILTERS.map((filter) => {
                const isActive = edgeFilters[filter.key];
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() =>
                      setEdgeFilters((prev) => ({
                        ...prev,
                        [filter.key]: !prev[filter.key],
                      }))
                    }
                    className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      isActive
                        ? 'border-white/30 bg-white/10 text-white/90'
                        : 'border-white/10 bg-black/30 text-white/50'
                    }`}
                    aria-pressed={isActive}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: filter.color }}
                    />
                    {filter.label}
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute top-4 right-4 z-10 px-4 py-3 rounded-xl bg-black/40 backdrop-blur text-xs text-white/60 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#e07a5f]" />
              <span>Person (claimed)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#81b29a]" />
              <span>Person (unclaimed)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3d405b]" />
              <span>Memory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f2cc8f]" />
              <span>Milestone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f4f1de]" />
              <span>Synchronicity</span>
            </div>
          </div>

          {/* Hovered node info */}
          {hoveredNode && (
            <div className="absolute bottom-4 left-4 z-10 px-4 py-3 rounded-xl bg-black/60 backdrop-blur text-white max-w-xs">
              <div className="font-medium">{hoveredNode.label}</div>
              <div className="text-xs text-white/60 mt-1 capitalize">{hoveredNode.type}</div>
              {hoveredNode.metadata?.year != null && (
                <div className="text-xs text-white/50 mt-1">Year: {String(hoveredNode.metadata.year)}</div>
              )}
              {hoveredNode.metadata?.visibility != null && (
                <div className="text-xs text-white/50 mt-1">
                  Visibility: {String(hoveredNode.metadata.visibility)}
                </div>
              )}
              {typeof hoveredNode.metadata?.claimed === 'boolean' && (
                <div className="text-xs text-white/50 mt-1">
                  {hoveredNode.metadata.claimed ? 'Has account' : 'No account yet'}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="absolute bottom-4 right-4 z-10 text-xs text-white/50">
            Drag to pan • Scroll (hold ⌘/Ctrl to zoom) • Hover for details
          </div>
        </>
      )}
    </div>
  );
}
