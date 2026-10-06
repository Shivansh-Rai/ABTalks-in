"use client";

import { useState } from "react";

export function CodeBlock({ lang, label, code }: { lang: string; label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="crs-code">
      <div className="crs-code-bar">
        <span>
          {label} <span style={{ opacity: 0.6 }}>· {lang}</span>
        </span>
        <button type="button" onClick={copy} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
