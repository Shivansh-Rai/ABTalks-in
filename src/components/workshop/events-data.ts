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
}

export const EVENTS: WorkshopEvent[] = [
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
  {
    id: "ai-content-creators",
    date: "2026-08-22",
    time: "4:30 PM IST",
    tag: "Creators",
    accent: "#ff4d94",
    icon: "✍️",
    title: "AI for Content Creators",
    desc: "Scripts, thumbnails, editing and repurposing — build a full AI content pipeline.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
  {
    id: "ship-ai-saas",
    date: "2026-09-05",
    time: "4:30 PM IST",
    tag: "Builders",
    accent: "#a855f7",
    icon: "🚀",
    title: "Ship Your First AI SaaS",
    desc: "From idea to deployed product — build and launch an AI app in a single weekend.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
  {
    id: "ai-data-dashboards",
    date: "2026-09-19",
    time: "4:30 PM IST",
    tag: "Data",
    accent: "#2dd4bf",
    icon: "📊",
    title: "AI for Data & Dashboards",
    desc: "Turn raw spreadsheets into insights, charts, and reports with AI in minutes.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
  {
    id: "land-ai-role",
    date: "2026-10-03",
    time: "4:30 PM IST",
    tag: "Career",
    accent: "#6366f1",
    icon: "🎯",
    title: "Land an AI Role: Portfolio Bootcamp",
    desc: "Build a standout AI portfolio and prep for interviews that get you hired.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
  {
    id: "no-code-automations",
    date: "2026-10-17",
    time: "4:30 PM IST",
    tag: "Automation",
    accent: "#ff9a3c",
    icon: "⚡",
    title: "No-Code AI Automations",
    desc: "Connect your tools and automate the boring work with AI — no code required.",
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
