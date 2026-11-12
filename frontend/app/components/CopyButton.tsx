"use client";

import { useState } from "react";

export function CopyButton({ payload }: { payload: object }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label = state === "copied" ? "✓ Copied" : state === "error" ? "✗ Failed" : "Copy JSON";
  const color =
    state === "copied" ? "rgba(16,185,129,0.3)" :
    state === "error"  ? "rgba(239,68,68,0.3)"  :
    "var(--border)";
  const textColor =
    state === "copied" ? "#34d399" :
    state === "error"  ? "#f87171" :
    "var(--text-muted)";

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-0.5 rounded border font-medium transition-all"
      style={{ color: textColor, borderColor: color, background: "var(--bg-base)" }}
    >
      {label}
    </button>
  );
}
