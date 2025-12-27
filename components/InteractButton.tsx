'use client';

import { useState } from 'react';

export default function InteractButton() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <span
        className="text-white/50 hover:text-white transition-colors cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(true)}
      >
        Interact
      </span>

      {/* Coming Soon Tooltip */}
      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-black/80 rounded text-[10px] text-white/50 whitespace-nowrap transition-all duration-150 z-[100] ${
          showTooltip ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        Coming soon
      </div>
    </div>
  );
}
