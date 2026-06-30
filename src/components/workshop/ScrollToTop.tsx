"use client";

export default function ScrollToTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      style={{
        padding: "14px 40px",
        borderRadius: "50px",
        border: "none",
        color: "#fff",
        fontWeight: 600,
        fontSize: "15px",
        cursor: "pointer",
        background: "linear-gradient(to right, #e16213, #e84393)",
        boxShadow: "0 4px 14px rgba(225,98,19,0.25)",
      }}
    >
      Register Now
    </button>
  );
}
