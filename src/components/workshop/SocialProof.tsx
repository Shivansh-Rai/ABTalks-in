"use client";

import { useState, useEffect } from "react";

const USERS = [
  { name: "Ayushi", org: "ABES Engineering College" },
  { name: "Rahul", org: "IIT Delhi" },
  { name: "Priya", org: "TCS" },
  { name: "Aman", org: "BITS Pilani" },
  { name: "Sneha", org: "Infosys" },
  { name: "Vikram", org: "NIT Warangal" },
  { name: "Ananya", org: "Wipro" },
  { name: "Karan", org: "DTU" },
];

export default function SocialProof() {
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIdx((p) => (p + 1) % USERS.length);
        setShow(true);
      }, 400);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const u = USERS[idx];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "12px 0",
        transition: "opacity 0.4s",
        opacity: show ? 1 : 0,
        fontSize: "15px",
      }}
    >
      <span style={{ fontSize: "18px" }}>👋</span>
      <span>
        <span style={{ fontWeight: 600, color: "#1f2937" }}>{u.name}</span>
        <span style={{ color: "#9ca3af", margin: "0 6px" }}>from</span>
        <span style={{ fontWeight: 700, color: "#111827" }}>{u.org}</span>
        <span style={{ color: "#9ca3af", fontStyle: "italic", marginLeft: "6px" }}>just joined</span>
      </span>
      <span
        style={{
          width: "10px",
          height: "10px",
          background: "#4ade80",
          borderRadius: "50%",
          display: "inline-block",
          marginLeft: "4px",
          animation: "pulse 2s infinite",
        }}
      />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
