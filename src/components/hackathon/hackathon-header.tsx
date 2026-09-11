import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/hackathon/account-menu";
import { SynergyChip } from "@/components/shared/synergy-chip";

/** Hackathon app header — the shared Design System v2 global header. */
export async function HackathonHeader() {
  const session = await auth();
  const email = session?.user?.email;

  return (
    <header className="abt-header z-50">
      <div className="abt-header-inner">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label="ABTalks home">
          <Image
            src="/abtalks-logo.png"
            alt="ABTalks"
            width={300}
            height={84}
            className="logo-image h-7 w-auto"
            priority
          />
        </Link>

        {email ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <SynergyChip />
            <AccountMenu email={email} />
          </div>
        ) : (
          <Link href="/login?from=/hackathon" className="abt-header-cta">
            Log In / Sign Up
          </Link>
        )}
      </div>
    </header>
  );
}
