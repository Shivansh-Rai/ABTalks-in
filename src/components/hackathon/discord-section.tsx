import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function DiscordSection() {
  return (
    <section
      id="discord"
      className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24"
    >
      <div className="rounded-[24px] border border-[#403880] bg-gradient-to-br from-[#1a1240] via-[#0b0722] to-[#030712] p-6 sm:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#5865F2]/20">
              <MessageCircle
                className="size-6 text-[#8B95FF]"
                aria-hidden
              />
            </div>
            <h2
              className="mt-5 bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
              style={{
                fontFamily: "var(--font-hackathon-mono), monospace",
              }}
            >
              Join the Discord — everyone must be in
            </h2>
            <p className="mt-4 max-w-2xl text-[clamp(1rem,1.6vw,1.125rem)] leading-relaxed text-[#D6DAFB]">
              Every participant is required to join our Discord server. Kickoff
              announcements, problem statements, teammate matching, judge Q&amp;A,
              and last-minute updates all happen there first. If you&apos;re not
              in the server, you&apos;ll miss it.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[#BCBCBC]">
              <li>
                <span className="text-[#968BEC]">→</span> Solo? Find teammates
                in <span className="font-mono text-white">#find-a-team</span>.
              </li>
              <li>
                <span className="text-[#968BEC]">→</span> Stuck?
                <span className="font-mono text-white"> #help</span> is
                monitored by mentors through the weekend.
              </li>
              <li>
                <span className="text-[#968BEC]">→</span> Winners and
                shout-outs are announced in{" "}
                <span className="font-mono text-white">#announcements</span>.
              </li>
            </ul>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-3 md:items-end">
            <Link
              href={HACKATHON.discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[52px] items-center justify-center rounded-[12px] bg-[#5865F2] px-8 text-center text-[16px] font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90"
            >
              Join the Discord →
            </Link>
            <p className="max-w-[240px] text-center text-xs text-[#BCBCBC] md:text-right">
              Opens Discord in a new tab. Free — no account needed until you
              accept the invite.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
