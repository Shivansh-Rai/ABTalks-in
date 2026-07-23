import Image from "next/image";
import Link from "next/link";

export function HackathonHeader() {
  return (
    <header className="relative z-50 w-full bg-black">
      <div className="mx-auto flex h-[72px] w-full max-w-[1897px] items-center justify-between px-4 sm:h-[100px] sm:px-9">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label="ABTalks home">
          <Image
            src="/hackathon/logo.png"
            alt="ABTalks"
            width={153}
            height={36}
            className="h-7 w-auto sm:h-9"
            priority
          />
        </Link>

        <Link
          href="/login"
          className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[#403880] px-4 text-center text-[11px] font-bold leading-none text-white transition-opacity hover:opacity-90 sm:h-[47px] sm:rounded-[10px] sm:px-8 sm:text-[16px]"
        >
          Log In / Sign Up
        </Link>
      </div>
    </header>
  );
}
