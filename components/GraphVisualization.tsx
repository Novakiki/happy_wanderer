'use client';

import { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';

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
  type: 'reference' | 'thread';
  label?: string;
  color: string;
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
  const sigmaRef = useRef<Sigma | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, people: 0, events: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const initGraph = async () => {
      try {
        // Fetch graph data
        const response = await fetch('/api/graph');
        if (!response.ok) throw new Error('Failed to fetch graph data');

        const data: GraphData = await response.json();

        if (data.nodes.length === 0) {
          setError('No data to visualize yet. Add some memories first!');
          setLoading(false);
          return;
        }

        // Create graphology instance
        const graph = new Graph();

        // Add nodes
        for (const node of data.nodes) {
          graph.addNode(node.id, {
            label: node.label,
            size: node.size,
            color: node.color,
            type: node.type,
            ...node.metadata,
          });
        }

        // Add edges
        for (const edge of data.edges) {
          if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
            try {
              graph.addEdge(edge.source, edge.target, {
                color: edge.color,
                size: 1,
                type: edge.type,
                label: edge.label,
              });
            } catch {
              // Edge may already exist
            }
          }
        }

        // Apply initial circular layout
        circular.assign(graph);

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

        // Calculate stats
        const people = data.nodes.filter((n) => n.type === 'person').length;
        const events = data.nodes.filter((n) => n.type === 'event').length;
        setStats({
          nodes: data.nodes.length,
          edges: data.edges.length,
          people,
          events,
        });

        // Create Sigma instance
        if (sigmaRef.current) {
          sigmaRef.current.kill();
        }

        const sigma = new Sigma(graph, containerRef.current!, {
          renderEdgeLabels: false,
          defaultNodeColor: '#999',
          defaultEdgeColor: 'rgba(255,255,255,0.1)',
          labelColor: { color: '#fff' },
          labelFont: 'Inter, system-ui, sans-serif',
          labelSize: 12,
          labelWeight: '500',
          stagePadding: 50,
          nodeReducer: (node, data) => {
            const res = { ...data };
            if (hoveredNode && hoveredNode.id !== node) {
              // Check if connected to hovered node
              const isConnected = graph.hasEdge(hoveredNode.id, node) || graph.hasEdge(node, hoveredNode.id);
              if (!isConnected) {
                res.color = 'rgba(100,100,100,0.3)';
                res.label = '';
              }
            }
            return res;
          },
          edgeReducer: (edge, data) => {
            const res = { ...data };
            if (hoveredNode) {
              const [source, target] = graph.extremities(edge);
              if (source !== hoveredNode.id && target !== hoveredNode.id) {
                res.color = 'rgba(100,100,100,0.1)';
              }
            }
            return res;
          },
        });

        // Event handlers
        sigma.on('enterNode', ({ node }) => {
          const attrs = graph.getNodeAttributes(node);
          setHoveredNode({
            id: node,
            label: attrs.label as string,
            type: attrs.type as string,
            metadata: attrs as Record<string, unknown>,
          });
        });

        sigma.on('leaveNode', () => {
          setHoveredNode(null);
        });

        sigmaRef.current = sigma;
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
    };
  }, []);

  // Update sigma when hoveredNode changes
  useEffect(() => {
    if (sigmaRef.current) {
      sigmaRef.current.refresh();
    }
  }, [hoveredNode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/20 rounded-2xl">
        <div className="text-white/60">Loading graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/20 rounded-2xl">
        <div className="text-white/60">{error}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Stats bar */}
      <div className="absolute top-4 left-4 z-10 flex gap-4 text-sm">
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
      </div>

      {/* Hovered node info */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 z-10 px-4 py-3 rounded-xl bg-black/60 backdrop-blur text-white max-w-xs">
          <div className="font-medium">{hoveredNode.label}</div>
          <div className="text-xs text-white/60 mt-1 capitalize">{hoveredNode.type}</div>
          {hoveredNode.metadata?.year != null && (
            <div className="text-xs text-white/50 mt-1">Year: {String(hoveredNode.metadata.year)}</div>
          )}
          {typeof hoveredNode.metadata?.claimed === 'boolean' && (
            <div className="text-xs text-white/50 mt-1">
              {hoveredNode.metadata.claimed ? 'Has account' : 'No account yet'}
            </div>
          )}
        </div>
      )}

      {/* Graph container */}
      <div
        ref={containerRef}
        className="h-[600px] w-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl"
        style={{ cursor: 'grab' }}
      />

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-10 text-xs text-white/50">
        Drag to pan • Scroll to zoom • Hover for details
      </div>
    </div>
  );
}
