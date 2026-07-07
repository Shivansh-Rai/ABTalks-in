"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only for devices with a precise pointer (skip touch).
    if (window.matchMedia("(hover: none)").matches) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${mx}px, ${my}px)`;
      }
    };

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx}px, ${ry}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[40] hidden md:block" aria-hidden>
      <div
        ref={glowRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 460,
          height: 460,
          marginLeft: -230,
          marginTop: -230,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,77,148,0.10) 0%, rgba(255,122,26,0.06) 35%, transparent 62%)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -13,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,154,60,0.45)",
          boxShadow: "0 0 12px 1px rgba(255,77,148,0.35)",
          willChange: "transform",
        }}
      />
    </div>
  );
}
