import { QUICK_QUESTION_IDS, CHATBOT_CATEGORIES, type ChatbotCategory } from "@/data/chatbot-menu";

const HARDCODED_ANSWERS: Record<string, string> = {
  "is-abtalks-free": "Yes! Community and every flagship program are free for participants.",
  "who-can-participate": "ABTalks serves four audiences: students, recruiters, working professionals, and investors.",
  "claude-challenge-tagging": "When you post your daily update, you must include the required tags: @abtalksonai, #abtalks, #60DaysOfClaude, #60DaysOfGenAI.",
  "ai-cohort-overview": "The 31-Day AI Cohort is a program where you build a production-grade enterprise chatbot in 31 days.",
  "contact-email": "You can contact the team directly at team@abtalks.in.",
};

const MAP: Record<string, string> = {
  "is-abtalks-free": "is abtalks free",
  "who-can-participate": "who can participate",
  "claude-challenge-tagging": "what are the required tags for the claude challenge",
  "ai-cohort-overview": "what is the ai cohort",
  "contact-email": "what is the contact email",
};

export function matchQuestion(query: string): { answer: string; confidence: number } | null {
  const lowerQuery = query.toLowerCase().trim();
  
  // Direct match for quick questions
  for (const id of QUICK_QUESTION_IDS) {
    if (lowerQuery.includes(MAP[id])) {
      return { answer: HARDCODED_ANSWERS[id], confidence: 1.0 };
    }
  }

  // Exact match for category numbers
  const asNumber = /^\d+$/.test(lowerQuery) ? parseInt(lowerQuery, 10) : null;
  if (asNumber !== null) {
    const category = CHATBOT_CATEGORIES.find((c) => c.number === asNumber);
    if (category) {
      return { answer: `You selected ${category.label}. I can answer any questions you have about this topic!`, confidence: 1.0 };
    }
  }

  return null;
}
