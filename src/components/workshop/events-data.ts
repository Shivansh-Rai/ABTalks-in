export interface WorkshopEvent {
  id: string;
  date: string; // ISO (YYYY-MM-DD)
  time: string;
  tag: string;
  accent: string;
  icon: string;
  title: string;
  desc: string;
  host: string;
  location: string;
  /** Open for registration now — its card links straight to the form. */
  register?: boolean;
}

export const EVENTS: WorkshopEvent[] = [
  {
    id: "ai-workshop-live",
    date: "2026-07-18",
    time: "4:00 PM IST",
    tag: "Live",
    accent: "#ff4d94",
    icon: "🎓",
    title: "FREE AI Bootcamp — Live Workshop",
    desc: "Master ChatGPT, Claude & Gemini in one hands-on live hour — prompt engineering, real workflows, and the tools that 10x your output.",
    host: "ABTalks",
    location: "Live · Google Meet",
    register: true,
  },
  {
    id: "ai-agents-claude",
    date: "2026-08-08",
    time: "4:30 PM IST",
    tag: "Advanced",
    accent: "#ff7a1a",
    icon: "🤖",
    title: "Building AI Agents with Claude",
    desc: "Design autonomous agents that plan, use tools, and complete multi-step tasks end to end.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
];

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const monthAbbr = (iso: string) =>
  utc(iso).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();

export const dayNum = (iso: string) =>
  utc(iso).toLocaleString("en-US", { day: "2-digit", timeZone: "UTC" });

export const weekday = (iso: string) =>
  utc(iso).toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });

export const fullDate = (iso: string) =>
  utc(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
