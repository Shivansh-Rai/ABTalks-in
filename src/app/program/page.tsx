import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  Cpu,
  Database,
  Network,
  Scale,
  Server,
  Sparkles,
} from "lucide-react";
import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getEntryState } from "@/features/program/entry";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "AI Cohort — ABTalks",
  description:
    "Build and deploy a production-grade enterprise AI chatbot in 31 days — RAG, agents, MCP, guardrails, Docker, Kubernetes — and get in front of recruiters.",
};

const phases = [
  {
    number: 0,
    title: "Env & Tooling",
    subtitle: "Days 1–3 · Local AI stack, Git, Ollama",
    Icon: Cpu,
  },
  {
    number: 1,
    title: "Data",
    subtitle: "Days 4–6 · Coverage data & structured queries",
    Icon: Database,
  },
  {
    number: 2,
    title: "Embeddings & Vector",
    subtitle: "Days 7–10 · Knowledge base + retrieval",
    Icon: Sparkles,
  },
  {
    number: 3,
    title: "LLM & Prompting",
    subtitle: "Days 11–15 · Prompting, fine-tune basics",
    Icon: BrainCircuit,
  },
  {
    number: 4,
    title: "App Build",
    subtitle: "Days 16–20 · Streamlit chatbot + FastAPI",
    Icon: Boxes,
  },
  {
    number: 5,
    title: "Agentic + MCP",
    subtitle: "Days 21–24 · Tools, agents, MCP servers",
    Icon: Network,
  },
  {
    number: 6,
    title: "Governance & Eval",
    subtitle: "Days 25–27 · Guardrails, evals, safety",
    Icon: Scale,
  },
  {
    number: 7,
    title: "Docker / K8s / Prod",
    subtitle: "Days 28–31 · Ship to production",
    Icon: Server,
  },
];

const steps = [
  { n: 1, label: "Apply", detail: "Confirm your laptop and GitHub setup." },
  {
    n: 2,
    label: "Entry assessment",
    detail: "A timed aptitude + basic programming check.",
  },
  {
    n: 3,
    label: "31 days of missions",
    detail: "Build locally; we verify your GitHub artifacts.",
  },
  {
    n: 4,
    label: "AI interview",
    detail: "A real-time voice interview to close it out.",
  },
  {
    n: 5,
    label: "Recruiter visibility",
    detail: "Ranked profile + your build portfolio.",
  },
];

async function getPrimaryCta(): Promise<{ label: string; href: string }> {
  const session = await auth();
  if (!session?.user?.id) return { label: "Apply now", href: "/program/apply" };

  const state = await getEntryState(session.user.id);
  switch (state.screen) {
    case "enrolled":
      return { label: "Go to dashboard", href: "/program/dashboard" };
    case "in_progress":
      return { label: "Continue assessment", href: "/program/assessment" };
    case "intro":
      return { label: "Continue application", href: "/program/apply" };
    case "cooldown":
    case "failed":
    case "waitlisted":
      return { label: "View status", href: "/program/apply" };
    default:
      return { label: "Apply now", href: "/program/apply" };
  }
}

export default async function ProgramLandingPage() {
  const cta = await getPrimaryCta();
  return (
    <main className="flex min-h-svh flex-col bg-gradient-to-br from-primary/5 via-background to-background">
      <section className="container mx-auto flex flex-col items-center px-6 pt-20 pb-12 text-center md:pt-28">
        <span className="mb-4 inline-flex items-center rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          For students & recent grads · ~2–4 hrs/day
        </span>
        <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          AI Cohort
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
          Build and deploy a production-grade enterprise AI chatbot in 31 days —
          RAG, agents, MCP, guardrails, Docker, Kubernetes — and get in front of
          recruiters.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={cta.href}
            className={cn(buttonVariants({ size: "lg" }), "px-6")}
          >
            {cta.label}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/talent/register"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "px-6",
            )}
          >
            I&apos;m a recruiter
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-6 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card/50 p-6 text-left">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Requirements
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Laptop with at least 8 GB RAM</li>
            <li>~2–4 hours per day for 31 days</li>
            <li>GitHub account</li>
            <li>
              Everything else is free (Ollama / Groq / Chroma — no paid API keys
              needed)
            </li>
          </ul>
        </div>
      </section>

      <section className="container mx-auto px-6 py-12">
        <h2 className="font-display mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">
          Eight phases, thirty-one days
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {phases.map((m) => (
            <Card key={m.number} className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <m.Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Phase {m.number}
                    </p>
                    <CardTitle className="text-lg">{m.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{m.subtitle}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-6 py-12">
        <h2 className="font-display mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">
          How it works
        </h2>
        <ol className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-border/60 bg-card/50 p-4"
            >
              <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {s.n}
              </div>
              <p className="font-medium">{s.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mx-auto px-6 pt-8 pb-24 text-center">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card/50 p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Ready to build?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Free for participants. One batch at a time — apply while enrollment
            is open.
          </p>
          <Link
            href={cta.href}
            className={cn(buttonVariants({ size: "lg" }), "mt-6 px-6")}
          >
            {cta.label}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
