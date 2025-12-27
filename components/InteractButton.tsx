'use client';

import { useState } from 'react';

export default function InteractButton() {
  const [showToast, setShowToast] = useState(false);

  return (
    <>
      <span
        className="text-white/50 hover:text-white transition-colors cursor-pointer"
        onMouseEnter={() => setShowToast(true)}
        onMouseLeave={() => setShowToast(false)}
        onClick={() => setShowToast(true)}
      >
        Interact
      </span>

      {/* Coming Soon Toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-sm text-white/70 transition-all duration-200 z-[100] ${
          showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        Coming soon
      </div>
    </>
  );
}
