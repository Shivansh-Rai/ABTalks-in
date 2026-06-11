import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { UserType } from "@prisma/client";
import {
  Activity,
  BadgeCheck,
  FileText,
  FolderGit2,
  GraduationCap,
  Sparkles,
  Target,
  Trophy,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getRecruiterProfileByToken } from "@/features/recruiter/get-recruiter-profile";
import { formatExperienceBucket } from "@/lib/profile-display";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "Candidate Profile | ABTalks",
  robots: { index: false },
};

function Wordmark({
  compact = false,
  variant = "hero",
}: {
  compact?: boolean;
  variant?: "hero" | "footer";
}) {
  const isHero = variant === "hero";
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-display font-bold",
          compact ? "size-6 text-xs" : "size-8 text-sm",
          isHero
            ? "bg-white/20 text-primary-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        AB
      </span>
      <span
        className={cn(
          "font-display font-bold tracking-tight",
          compact ? "text-sm" : "text-xl",
          isHero ? "text-primary-foreground" : "text-foreground",
        )}
      >
        ABTalks
      </span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
    </div>
  );
}

function StarRating({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;

  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex gap-0.5" aria-label={`${label}: ${value} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={cn(
                "text-lg",
                n <= value ? "text-amber-500" : "text-muted-foreground/30",
              )}
              aria-hidden
            >
              ★
            </span>
          ))}
        </div>
        <span className="text-sm font-semibold">{value}/5</span>
      </div>
    </div>
  );
}

export default async function RecruiterProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const profile = await getRecruiterProfileByToken(token);
  if (!profile) notFound();

  const progressPct =
    profile.totalDays > 0
      ? Math.round((profile.daysCompleted / profile.totalDays) * 100)
      : 0;

  const hasRatings =
    profile.ratings.confidence != null ||
    profile.ratings.coding != null ||
    profile.ratings.communication != null;

  return (
    <div
      className={cn(
        "min-h-svh bg-muted/30 text-foreground print:min-h-0 print:bg-white",
        "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
      )}
    >
      <div className="mx-auto my-6 max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-sm print:my-0 print:rounded-none print:border-0 print:shadow-none">
        <header className="bg-gradient-to-br from-primary to-violet-500 px-6 py-7 text-primary-foreground print:bg-primary">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Wordmark />
            <Badge className="border-0 bg-white/20 text-primary-foreground hover:bg-white/20">
              Verified by ABTalks
            </Badge>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl font-bold">{profile.fullName}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-white/30 bg-white/15 text-primary-foreground"
              >
                {profile.domain}
              </Badge>
              {profile.isReadyForInterview ? (
                <Badge className="border-0 bg-white/20 text-primary-foreground hover:bg-white/20">
                  Ready for interview
                </Badge>
              ) : null}
            </div>
            {profile.userType === UserType.STUDENT ? (
              <p className="text-primary-foreground/80">
                {profile.college}
                {profile.graduationYear != null
                  ? ` · Class of ${profile.graduationYear}`
                  : null}
              </p>
            ) : (
              <p className="text-primary-foreground/80">
                {profile.role}
                {profile.organization ? ` at ${profile.organization}` : null}
                {profile.yearsExperience != null
                  ? ` · ${formatExperienceBucket(profile.yearsExperience)} experience`
                  : null}
              </p>
            )}
            {profile.headline ? (
              <p className="text-lg text-primary-foreground/95">
                {profile.headline}
              </p>
            ) : null}
          </div>
        </header>

        <div className="space-y-8 px-6 py-6">
          {hasRatings ? (
            <section className="grid gap-4 sm:grid-cols-3">
              <StarRating
                value={profile.ratings.confidence}
                label="Confidence"
              />
              <StarRating
                value={profile.ratings.coding}
                label="Coding skills"
              />
              <StarRating
                value={profile.ratings.communication}
                label="Communication"
              />
            </section>
          ) : null}

          {profile.summary ? (
            <section>
              <SectionHeader icon={FileText} title="Summary" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {profile.summary}
              </p>
            </section>
          ) : null}

          {profile.strengths.length > 0 ? (
            <section>
              <SectionHeader icon={Sparkles} title="Key strengths" />
              <div className="flex flex-wrap gap-2">
                {profile.strengths.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="border-primary/30 bg-primary/5 text-foreground"
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {profile.projects.length > 0 ? (
            <section>
              <SectionHeader icon={FolderGit2} title="Projects" />
              <div className="space-y-3">
                {profile.projects.map((project) => (
                  <div key={project.title} className="rounded-xl border p-3">
                    <p className="font-semibold">{project.title}</p>
                    {project.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {profile.education.length > 0 ? (
            <section>
              <SectionHeader icon={GraduationCap} title="Education & marks" />
              <div className="space-y-3">
                {profile.education.map((row) => (
                  <div
                    key={`${row.degree}-${row.institution}`}
                    className="rounded-xl border p-3"
                  >
                    <p className="font-semibold">{row.degree}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.institution}
                    </p>
                    {(row.year || row.score) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {row.year ? (
                          <Badge variant="secondary">{row.year}</Badge>
                        ) : null}
                        {row.score ? (
                          <Badge variant="outline">{row.score}</Badge>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {profile.achievements.length > 0 ? (
            <section>
              <SectionHeader icon={Trophy} title="Achievements" />
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {profile.achievements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.certifications.length > 0 ? (
            <section>
              <SectionHeader icon={BadgeCheck} title="Certifications" />
              <div className="flex flex-wrap gap-2">
                {profile.certifications.map((cert) => (
                  <Badge key={cert} variant="outline">
                    {cert}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {profile.recommendedRoles.length > 0 ? (
            <section>
              <SectionHeader icon={Target} title="Recommended roles" />
              <div className="flex flex-wrap gap-2">
                {profile.recommendedRoles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border bg-muted/20 p-4">
            <SectionHeader icon={Activity} title="ABTalks-verified consistency" />
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Challenge progress</span>
                  <span className="font-medium">
                    {profile.daysCompleted} / {profile.totalDays} days
                  </span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Current streak:</span>{" "}
                  <span className="font-medium">{profile.currentStreak}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Longest streak:</span>{" "}
                  <span className="font-medium">{profile.longestStreak}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Community contribution:
                  </span>{" "}
                  <span className="font-medium">{profile.synergyPoints}</span>
                </p>
              </div>
            </div>
          </section>

          {profile.skills.length > 0 ? (
            <section>
              <SectionHeader icon={Wrench} title="Skills" />
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="flex flex-col items-start justify-between gap-4 border-t px-6 py-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Interested? Connect with this candidate through{" "}
              <strong className="text-foreground">ABTalks</strong>.
            </p>
            <Wordmark compact variant="footer" />
          </div>
          <PrintButton />
        </footer>
      </div>
    </div>
  );
}
