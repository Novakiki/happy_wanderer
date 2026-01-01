'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import to avoid SSR issues with Sigma.js (uses canvas/WebGL)
const GraphVisualization = dynamic(
  () => import('@/components/GraphVisualization'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-black/20 rounded-2xl">
        <div className="text-white/60">Loading visualization...</div>
      </div>
    ),
  }
);

export default function GraphPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0a0a0a] to-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-white/50 hover:text-white/70 text-sm transition-colors"
          >
            ← Back to timeline
          </Link>
          <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
            Memory Graph
          </h1>
          <p className="text-white/60 mt-2">
            A visualization of people and memories, connected through stories.
          </p>
        </div>

        {/* Graph */}
        <GraphVisualization />

        {/* Explanation */}
        <div className="mt-8 grid sm:grid-cols-2 gap-6 text-sm text-white/60">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-white font-medium mb-2">How it works</h3>
            <p>
              Each node represents either a person or a memory. Lines connect
              people to the memories they appear in, and memories to their
              responses (story chains).
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-white font-medium mb-2">Privacy-aware</h3>
            <p>
              People who haven&apos;t claimed their identity appear in green.
              Once they create an account and set their preferences, their
              visibility across all connected memories updates automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
