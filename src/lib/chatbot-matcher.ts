import { CHATBOT_CATEGORIES } from "@/data/chatbot-menu";

const INTENTS: { regex: RegExp; answer: string }[] = [
  {
    regex: /\b(how\s*to\s*)?(apply|join|work\s*for)\s*(to\s*)?(the\s*)?(abtalks|team|company)\b/i,
    answer: "If you're interested in joining the ABTalks team or working with us, please email your cover letter, resume, and any other relevant details to team@abtalks.in!",
  },
  {
    regex: /\b(how\s*to\s*)?(apply|register|sign\s*up|join)\s*(to\s*)?(program|cohort|challenge)\b/i,
    answer: "To join an ABTalks program, you can sign in using your Google account at /login. We have multiple programs you can sign up for: The 60-Day Coding Challenge (/challenges), the 60-Day Claude AI Challenge (/claude-signup), and the 31-Day AI Cohort (/ai-cohort-register).",
  },
  {
    regex: /\b(what is|tell me about)\s*(the\s*)?(60\s*day\s*coding\s*challenge|coding\s*challenge)\b/i,
    answer: "The 60-Day Coding Challenge is a self-paced, community-driven program where you complete one coding task every day for 60 days. You track your progress on our platform, and it's completely free to participate. You can sign up at /challenges!",
  },
  {
    regex: /\b(what is|tell me about)\s*(the\s*)?(60\s*day\s*claude\s*challenge|claude\s*ai\s*challenge)\b/i,
    answer: "The 60-Day Claude AI Challenge focuses on mastering prompt engineering. Every day you'll receive a new AI prompt task to complete using Claude. To participate, post your daily update with the required tags: @abtalksonai, #abtalks, #60DaysOfClaude, #60DaysOfGenAI. Sign up at /claude-signup!",
  },
  {
    regex: /\b(what is|tell me about)\s*(the\s*)?(ai\s*cohort|talent\s*hunt)\b/i,
    answer: "The 31-Day AI Cohort is an intensive, application-gated program where you build a production-grade enterprise chatbot over 8 phases. It requires a commitment of 2-4 hours a day and is completely free. You can apply at /ai-cohort-register.",
  },
  {
    regex: /\b(who is|tell me about)\s*(anil\s*bajpai|founder|the\s*founder|core\s*team)\b/i,
    answer: "Anil Bajpai is the founder of ABTalks. Our core team also includes Sarthak, Sohail, and Suyash as Founding Members, and Rudra handling Sales, Marketing, and social media queries. You can connect with them on LinkedIn or reach out to team@abtalks.in.",
  },
  {
    regex: /\b(how\s*many|which)\s*countries\b/i,
    answer: "ABTalks is a global community! We have active members and builders from across the world.",
  },
  {
    regex: /\b(what|which)\s*(subjects?|topics?|technologies?)\b/i,
    answer: "Our programs cover a wide range of modern tech skills, including Software Engineering, Data Science, Artificial Intelligence, prompt engineering (with Claude/ChatGPT), and building production-ready apps with React, Docker, and Kubernetes.",
  },
  {
    regex: /\b(tell me about|what is)\s*(the\s*)?(community|abtalks\s*community)\b/i,
    answer: "The ABTalks community is a vibrant network of over 10,000 students, working professionals, and tech enthusiasts. We focus on building in public, collaborating on projects, and accelerating careers. You can join the conversation on our Discord or WhatsApp groups!",
  },
  {
    regex: /\b(next|upcoming|future|new)\s*cohorts?\b/i,
    answer: "Our flagship cohort is the 31-Day AI Cohort, where you build a production-grade enterprise chatbot. Applications open periodically — you can check the current status and apply at /ai-cohort-register.",
  },
  {
    regex: /\b(next|upcoming|future|new)\s*challenges?\b/i,
    answer: "We currently offer two major challenges: The 60-Day Coding Challenge (/challenges) and the 60-Day Claude AI Challenge (/claude-signup). Both are self-paced and you can start them anytime!",
  },
  {
    regex: /\b(jobs?|placements?|internships?|hiring|recruiters?)\b/i,
    answer: "ABTalks helps connect talent with opportunities! We have a Recruiter/Talent portal at /talent and a Jobs board at /jobs. While we can't guarantee a specific job or placement, participating in our hackathons and challenges is a great way to get discovered by recruiters.",
  },
  {
    regex: /\b(what is|tell me about)\s*abtalks\b/i,
    answer: "ABTalks is India's coding community for college students and professionals to learn, build, and accelerate careers through visible proof of work. Our core loop is: Learn Daily → Build & Showcase → Get Hired.",
  },
  {
    regex: /\b(contact|email|reach\s*out|support)\b/i,
    answer: "You can reach the ABTalks team directly at team@abtalks.in, or visit the /contact page. We're also active on LinkedIn, Instagram (@abtalksonai), and our Discord/WhatsApp communities!",
  },
  {
    regex: /\b(is\s*it\s*free|pricing|cost|how\s*much)\b/i,
    answer: "Yes! The ABTalks platform, including our flagship programs (AI Cohort, Coding Challenge, Hackathons), is completely free for participants.",
  },
  {
    regex: /\b(what is|tell me about)\s*(the\s*)?(vibe\s*code\s*)?hackathon\b/i,
    answer: "The Vibe Code Hackathon is our flagship 48-hour event where you build anything using AI. It's free to enter (solo or teams of up to 3), and requires submitting a public GitHub repo, live URL, and AI-usage log.",
  },
  {
    regex: /\b(certificates?|certification)\b/i,
    answer: "Yes, eligible completions of our programs award certificates of participation or completion. Each certificate comes with a publicly verifiable ID at /verify/[certificateId].",
  },
  {
    regex: /\b(synergy\s*points?|sp)\b/i,
    answer: "Synergy Points (SP) are a promotional loyalty balance earned through participation. They have no cash value, but can be redeemed for marketplace items (like merch) where available.",
  }
];

export function matchQuestion(query: string): { answer: string; confidence: number } | null {
  const lowerQuery = query.toLowerCase().trim();
  
  // Exact match for category numbers from the menu
  const asNumber = /^\d+$/.test(lowerQuery) ? parseInt(lowerQuery, 10) : null;
  if (asNumber !== null) {
    const category = CHATBOT_CATEGORIES.find((c) => c.number === asNumber);
    if (category) {
      return { answer: `You selected ${category.label}. I can answer any questions you have about this topic!`, confidence: 1.0 };
    }
  }

  // Regex intent matching for zero-LLM responses
  for (const intent of INTENTS) {
    if (intent.regex.test(lowerQuery)) {
      // Shorter queries have higher confidence that they strictly map to this intent
      // We don't want a 50-word question to accidentally hit an interceptor
      if (lowerQuery.length < 80) {
        return { answer: intent.answer, confidence: 1.0 };
      }
    }
  }

  return null;
}
