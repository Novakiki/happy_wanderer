'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ContinueButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/letter", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to continue");
      }
      router.push("/score");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={handleContinue}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-[#d06a4f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Opening..." : "Enter the site"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
