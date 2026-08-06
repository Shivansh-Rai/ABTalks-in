import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

function Highlight({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-[#C4B5FD]">{children}</span>;
}

function Accent({ children }: { children: ReactNode }) {
  return <span className="text-[#A78BFA]">{children}</span>;
}

export function EvaluationRules() {
  return (
    <details
      open
      className="group mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors open:border-[#7364E6]/40 open:bg-[#7364E6]/[0.06] sm:mt-10 sm:p-6"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <h2 className="min-w-0 flex-1 text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
          Hackathon Rules and Evaluation Process
        </h2>
        <ChevronDown className="ml-auto size-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-5 space-y-8">
        <p className="text-sm leading-relaxed text-zinc-300">
          To ensure a fair competition, every submission goes through a{" "}
          <Highlight>four-stage</Highlight> evaluation process. Automated
          verification is completed before judging so that judges only review
          valid submissions.
        </p>

        <Stage
          number={1}
          title="Eligibility Verification"
          method={
            <>
              Automatic Verification | <Highlight>Pass / Fail</Highlight>
            </>
          }
        >
          <p>
            All submissions are automatically verified during submission and
            rechecked after the submission deadline.
          </p>
          <p>
            A submission <Accent>must</Accent> satisfy{" "}
            <Highlight>all</Highlight> of the following requirements:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Repository must be <Highlight>publicly accessible</Highlight>.
            </li>
            <li>Repository URL must be valid and accessible.</li>
            <li>
              Live Demo URL must be functional and return a working application.
            </li>
            <li>AI Usage Log must be included and accessible.</li>
            <li>Submission must belong to a registered team.</li>
            <li>
              Submission must be received before the official deadline.
            </li>
          </ul>
          <p>
            Any submission that fails one or more of the above requirements will
            not proceed to judging.
          </p>
        </Stage>

        <Stage
          number={2}
          title="Authenticity Review"
          method="Automated Analysis + Manual Review"
        >
          <p>
            This stage verifies that the project was genuinely created during
            the hackathon.
          </p>
          <p>
            The following indicators may trigger a manual review or even{" "}
            <Highlight>disqualification</Highlight>:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Repository was created before the official hackathon kickoff.
            </li>
            <li>
              The first commit already contains most of the project, indicating
              an imported codebase.
            </li>
            <li>
              Commit history shows little or no development activity during the
              hackathon, followed by a large final commit.
            </li>
            <li>
              The AI Usage Log does not reasonably correspond to the implemented
              features.
            </li>
            <li>
              Prompt history appears incomplete, generic, or unrelated to the
              submitted project.
            </li>
          </ul>
        </Stage>

        <Stage
          number={3}
          title="Project Judging"
          method={
            <>
              Two Independent Judges | <Highlight>100 Points</Highlight>
            </>
          }
        >
          <p>
            Eligible submissions are evaluated independently by the judges using
            the published judging rubric.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Each judge scores the project separately.</li>
            <li>Judges do not see each other&apos;s scores.</li>
            <li>The final score is the average of both judges&apos; scores.</li>
            <li>
              If the difference between the two scores exceeds{" "}
              <Highlight>15 points</Highlight>, a third judge will evaluate the
              project.
            </li>
            <li>
              In such cases, the <Highlight>median score</Highlight> of the
              three judges becomes the final score.
            </li>
          </ul>
          <p>
            Only submissions that successfully complete Stages 1 and 2 are
            evaluated by judges.
          </p>
        </Stage>

        <Stage
          number={4}
          title="Live Steer Challenge"
          method={
            <>
              Final Round | <Highlight>Top 6 Teams</Highlight>
            </>
          }
        >
          <p>
            The six highest-scoring teams qualify for the Live Steer Challenge.
          </p>
          <p>Each finalist team will:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Join a live video call.</li>
            <li>Share their screen throughout the challenge.</li>
            <li>Receive the same previously unseen feature request.</li>
            <li>
              Implement the feature within <Highlight>20 minutes</Highlight>{" "}
              using their own repository.
            </li>
            <li>Use any AI tools they used during the hackathon.</li>
          </ul>
          <p>
            The Live Steer Challenge ensures that finalists can demonstrate the
            same AI-assisted development skills used throughout the hackathon.
          </p>
        </Stage>

        <p className="border-t border-white/10 pt-5 text-sm leading-relaxed text-zinc-400">
          All verification and judging decisions made by the organizers are{" "}
          <Highlight>final</Highlight>.
        </p>
      </div>
    </details>
  );
}

function Stage({
  number,
  title,
  method,
  children,
}: {
  number: number;
  title: string;
  method: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#7364E6]/40 bg-[#7364E6]/15 font-mono text-sm font-bold text-[#C4B5FD]">
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">
            Stage {number}: {title}
          </h3>
          <p className="mt-1 text-sm font-medium text-[#A78BFA]">{method}</p>
        </div>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}
