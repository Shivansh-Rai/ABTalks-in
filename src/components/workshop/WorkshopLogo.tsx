import Image from "next/image";
import Link from "next/link";

export default function WorkshopLogo() {
  return (
    <Link
      href="/ai-workshop"
      aria-label="ABTalks — AI Workshop"
      className="wk-logo group relative inline-flex shrink-0 overflow-hidden rounded-md"
    >
      <style>{`
        .wk-logo::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%);
          transform: translateX(-130%) skewX(-15deg);
          pointer-events: none;
        }
        .wk-logo:hover::after { animation: wk-logo-shine 0.75s ease forwards; }
        @keyframes wk-logo-shine { to { transform: translateX(130%) skewX(-15deg); } }
        .wk-logo img { transition: filter 0.3s ease, transform 0.3s ease; }
        .wk-logo:hover img {
          filter: drop-shadow(0 0 10px rgba(255,122,26,0.55));
          transform: scale(1.03);
        }
      `}</style>
      <Image
        src="/abtalks-logo.png"
        alt="ABTalks"
        width={300}
        height={84}
        priority
        className="block h-6 w-auto max-w-none object-cover object-left sm:h-7"
      />
    </Link>
  );
}
