export const SUPPORT_EMAIL = "team@abtalks.in";

export type ChatbotCategory = {
  id: string;
  number: number;
  label: string;
};

export const CHATBOT_CATEGORIES: ChatbotCategory[] = [
  { id: "about", number: 1, label: "About ABTalks" },
  { id: "programs", number: 2, label: "Programs & Challenges" },
  { id: "hackathons", number: 3, label: "Hackathons" },
  { id: "workshops-events", number: 4, label: "Workshops & Events" },
  { id: "claude-challenge", number: 5, label: "Claude Challenge" },
  { id: "ai-cohort", number: 6, label: "AI Cohort" },
  { id: "socials-contact", number: 7, label: "Socials & Contact" },
];

export const QUICK_QUESTION_IDS = [
  "is-abtalks-free",
  "who-can-participate",
  "claude-challenge-tagging",
  "ai-cohort-overview",
  "contact-email",
];
