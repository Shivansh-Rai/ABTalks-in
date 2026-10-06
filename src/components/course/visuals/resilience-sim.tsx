"use client";

import { useId, useState } from "react";
import type { ResilienceVisual } from "@/features/courses/types";

type Mode = "flaky" | "outage" | "slow";
type Line = { k: "ok" | "err" | "warn" | "info"; t: string };

const REQUESTS = 20;
const OK_MS = 300;
const ERR_MS = 200;
const HANG_MS = 30000;
const TIMEOUT_MS = 2000;
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN = 5;

/**
 * Resilience lab: send a batch of requests to an unreliable dependency and
 * toggle retries, timeouts, a circuit breaker and a fallback to see how each
 * changes success rate, load on the dependency and user-facing latency.
 */
export function ResilienceSim({ config }: { config: ResilienceVisual }) {
  const id = useId();
  const dep = config.dependency;
  const [mode, setMode] = useState<Mode>("flaky");
  const [rate, setRate] = useState(config.failureRate);
  const [retries, setRetries] = useState(0);
  const [timeout, setTimeoutOn] = useState(false);
  const [breaker, setBreaker] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [log, setLog] = useState<Line[]>([]);
  const [stats, setStats] = useState<null | { ok: number; fb: number; fail: number; calls: number; worst: number; avg: number }>(null);

  function run() {
    const lines: Line[] = [];
    let ok = 0, fb = 0, fail = 0, calls = 0, worst = 0, total = 0;
    let consecutive = 0;
    let openFor = 0;
    for (let r = 1; r <= REQUESTS; r++) {
      let ms = 0;
      let success = false;
      if (breaker && openFor > 0) {
        openFor--;
        lines.push({ k: "warn", t: `#${r} breaker OPEN → skipped ${dep} (fail fast)` });
      } else {
        const halfOpen = breaker && openFor === 0 && consecutive >= BREAKER_THRESHOLD;
        const attempts = halfOpen ? 1 : retries + 1;
        for (let a = 0; a < attempts; a++) {
          calls++;
          const failed = mode === "outage" ? true : Math.random() < rate;
          if (!failed) {
            ms += OK_MS;
            success = true;
            break;
          }
          ms += mode === "slow" ? (timeout ? TIMEOUT_MS : HANG_MS) : ERR_MS;
          if (a < attempts - 1) ms += 250 * 2 ** a;
        }
        if (success) {
          consecutive = 0;
          lines.push({ k: "ok", t: `#${r} ${dep} ok${halfOpen ? " (half-open trial passed → breaker CLOSED)" : ""} · ${ms}ms` });
        } else {
          consecutive++;
          const tripped = breaker && consecutive >= BREAKER_THRESHOLD;
          if (tripped) openFor = BREAKER_COOLDOWN;
          lines.push({
            k: "err",
            t: `#${r} ${dep} failed after ${attempts} attempt${attempts > 1 ? "s" : ""} · ${ms}ms${tripped ? " → breaker OPEN" : ""}`,
          });
        }
      }
      if (success) ok++;
      else if (fallback) {
        fb++;
        ms += 50;
        lines.push({ k: "info", t: `   ↳ fallback served (cached / degraded answer)` });
      } else fail++;
      worst = Math.max(worst, ms);
      total += ms;
    }
    setLog(lines);
    setStats({ ok, fb, fail, calls, worst, avg: Math.round(total / REQUESTS) });
  }

  const toggle = (label: string, on: boolean, set: (v: boolean) => void) => (
    <button type="button" className="crs-chip" aria-pressed={on} onClick={() => set(!on)}>
      {label}: {on ? "on" : "off"}
    </button>
  );

  return (
    <div>
      <div style={{ fontSize: "0.78rem", color: "var(--c-mu)", marginBottom: 6 }}>How is {dep} misbehaving?</div>
      <div className="crs-controls" style={{ marginTop: 0 }} role="group" aria-label="Failure mode">
        {(["flaky", "slow", "outage"] as Mode[]).map((m) => (
          <button key={m} type="button" className="crs-chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "flaky" ? "Flaky (random errors)" : m === "slow" ? "Slow (hangs when failing)" : "Hard outage"}
          </button>
        ))}
      </div>
      {mode !== "outage" ? (
        <div style={{ marginTop: 10 }}>
          <label htmlFor={id} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Failure probability: {Math.round(rate * 100)}%
          </label>
          <input id={id} className="crs-range" type="range" min={0} max={0.9} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </div>
      ) : null}
      <div style={{ fontSize: "0.78rem", color: "var(--c-mu)", margin: "10px 0 6px" }}>Defences</div>
      <div className="crs-controls" style={{ marginTop: 0 }} role="group" aria-label="Defences">
        <button type="button" className="crs-chip" aria-pressed={retries > 0} onClick={() => setRetries((r) => (r + 1) % 4)}>
          Retries: {retries} {retries > 0 ? "(exp. backoff)" : ""}
        </button>
        {toggle("Timeout 2s", timeout, setTimeoutOn)}
        {toggle("Circuit breaker", breaker, setBreaker)}
        {toggle("Fallback", fallback, setFallback)}
      </div>
      <div className="crs-controls">
        <button type="button" className="crs-btn" onClick={run}>
          Send {REQUESTS} requests
        </button>
        <button
          type="button"
          className="crs-btn crs-btn-ghost"
          onClick={() => {
            setLog([]);
            setStats(null);
            setMode("flaky");
            setRate(config.failureRate);
            setRetries(0);
            setTimeoutOn(false);
            setBreaker(false);
            setFallback(false);
          }}
        >
          Reset
        </button>
      </div>
      {stats ? (
        <div className="crs-stat" aria-live="polite">
          <div><b>{stats.ok}</b>succeeded</div>
          <div><b>{stats.fb}</b>fallback</div>
          <div><b>{stats.fail}</b>failed to user</div>
          <div><b>{stats.calls}</b>calls to {dep}</div>
          <div><b>{(stats.avg / 1000).toFixed(1)}s</b>avg latency</div>
          <div><b>{(stats.worst / 1000).toFixed(1)}s</b>worst latency</div>
        </div>
      ) : null}
      {log.length > 0 ? (
        <div className="crs-log" role="log" aria-label="Request log">
          {log.map((l, i) => (
            <div key={i} data-k={l.k}>
              {l.t}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
