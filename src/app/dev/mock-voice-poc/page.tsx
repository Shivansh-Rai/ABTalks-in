import { notFound } from "next/navigation";
import { MockVoicePocClient } from "./client";

export const metadata = {
  title: "Mock AI Interview — Realtime Voice POC (Phase 1)",
  description: "Isolated proof-of-concept for OpenAI Realtime WebRTC full-duplex conversational voice with instant barge-in.",
};

export default function MockVoicePocPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <MockVoicePocClient />;
}
