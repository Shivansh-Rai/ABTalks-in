import type { Metadata } from "next";
import Link from "next/link";
import EventsTimeline from "@/components/workshop/EventsTimeline";
import WorkshopLogo from "@/components/workshop/WorkshopLogo";

export const metadata: Metadata = {
  title: "Upcoming Events | ABTalks AI Workshop",
  description:
    "All upcoming ABTalks live AI workshops and events — agents, content, SaaS, data, careers and automation.",
};

export default function WorkshopEventsPage() {
  return (
    <div
      className="relative min-h-screen"
      style={{ background: "#08060d", color: "#f4f2f7", overflowX: "clip" }}
    >
      {/* ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          style={{
            position: "absolute",
            top: "-160px",
            left: "-120px",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,122,26,0.22), transparent 65%)",
            filter: "blur(70px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "20%",
            right: "-160px",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.16), transparent 65%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div className="relative z-10">
        {/* top bar */}
        <header
          className="sticky top-0 z-50 w-full px-4"
          style={{
            background: "rgba(10,7,16,0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <WorkshopLogo />
              <div className="hidden h-4 w-px bg-white/15 sm:block" />
              <span
                className="hidden rounded-md px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-widest sm:inline-block"
                style={{
                  background: "rgba(255,122,26,0.12)",
                  color: "#ff9a3c",
                  border: "1px solid rgba(255,122,26,0.25)",
                }}
              >
                AI Workshop
              </span>
            </div>
            <Link
              href="/ai-workshop"
              className="text-[13px] font-medium text-white/55 transition-colors hover:text-white"
            >
              ← Back to Workshop
            </Link>
          </div>
        </header>

        <EventsTimeline />

        {/* bottom CTA */}
        <div className="mx-auto max-w-3xl px-4 pb-16 text-center">
          <p className="text-sm text-white/45">Don&apos;t miss the next one.</p>
          <Link
            href="/ai-workshop#register"
            className="mt-4 inline-flex items-center gap-2 rounded-full px-7 py-3 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #ff7a1a 0%, #ff4d94 100%)",
              boxShadow: "0 12px 30px -10px rgba(255,77,148,0.6), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            Reserve Your Free Seat →
          </Link>
        </div>

        <footer className="border-t border-white/5 px-4 py-8 text-center">
          <p className="text-[13px] text-white/35">
            © {new Date().getFullYear()} ABTalks · AI Workshop
          </p>
        </footer>
      </div>
    </div>
  );
}
