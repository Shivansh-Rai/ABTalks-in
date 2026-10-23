import Link from "next/link";
import { ArrowRight, Coins, ShoppingBag } from "lucide-react";
import { EarningPills } from "@/components/marketplace/earning-pills";

/**
 * Shown at /marketplace while the code switch in
 * features/marketplace/status.ts is off. Server Component: no state, no
 * client JS; the coin float is pure CSS and stops under reduced motion.
 */
export function MarketplaceClosed({ balance }: { balance: number | null }) {
  return (
    <section className="relative w-full flex-1 overflow-hidden bg-gradient-to-b from-[#EEF6F6] to-[#F4F4F4]">
      <style>{`
        @keyframes mkc-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes mkc-swing { 0%,100% { transform: rotate(-2.5deg) } 50% { transform: rotate(2.5deg) } }
        .mkc-coin { animation: mkc-float 4s ease-in-out infinite; transform-box: fill-box; }
        .mkc-coin-b { animation-delay: -1.4s; }
        .mkc-coin-c { animation-delay: -2.6s; }
        .mkc-sign { animation: mkc-swing 5s ease-in-out infinite; transform-box: view-box; transform-origin: 240px 176px; }
        @media (prefers-reduced-motion: reduce) { .mkc-coin, .mkc-sign { animation: none; } }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 90% at 80% 30%, rgba(3, 83, 95, 0.08) 0%, rgba(3, 83, 95, 0) 60%)",
        }}
      />

      {/* minmax(0, …) on every column: without it the grid sizes to the
          illustration's intrinsic width and the page scrolls sideways on phones. */}
      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-8 px-5 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:py-20">
        {/* Illustration first on phones, right column on desktop. */}
        <div className="order-first mx-auto w-full min-w-0 max-w-[460px] lg:order-last lg:max-w-none">
          <ClosedStall />
        </div>

        <div className="flex min-w-0 flex-col items-start gap-5">
          <span className="inline-flex items-center gap-2 font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.18em] text-[#03535F]">
            <ShoppingBag className="size-4" aria-hidden />
            Marketplace
          </span>
          <h1 className="text-[34px] leading-[40px] font-bold tracking-tight text-black sm:text-[44px] sm:leading-[50px] lg:text-[52px] lg:leading-[58px]">
            The marketplace is{" "}
            <span className="text-[#03535F]">currently closed</span>
          </h1>
          <p className="max-w-lg text-base leading-[25px] text-[#4B4B4B] sm:text-[17px] sm:leading-7">
            We&apos;re restocking the shelves with new rewards. Your Synergy
            Points are safe and keep adding up, ready to spend the moment the
            doors open again.
          </p>

          {balance !== null ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#E0E0E0] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              <span
                className="flex size-10 items-center justify-center rounded-full bg-[#FFF4D6] text-[#AA821D]"
                aria-hidden
              >
                <Coins className="size-5" />
              </span>
              <div>
                <p className="text-xs text-[#626262]">Your balance, saved for later</p>
                <p className="font-heading text-xl font-bold text-black">
                  {balance.toLocaleString("en-IN")}{" "}
                  <span className="text-base font-semibold text-[#03535F]">SP</span>
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-[#353535]">
              Keep earning while you wait
            </p>
            <EarningPills />
          </div>

          <div className="mt-1 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#03535F] px-5 text-sm font-semibold text-white shadow-[inset_0_-5px_14px_rgba(0,0,0,0.34)] transition-colors hover:bg-[#076573] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
            >
              Back to dashboard
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/workshop"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E0E0E0] bg-white px-5 text-sm font-semibold text-black transition-colors hover:border-[#A6D2D5] hover:bg-[#EEF6F6] hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
            >
              Explore events
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A market stall, shutter down, CLOSED sign swinging, coins drifting. */
function ClosedStall() {
  const stripes = Array.from({ length: 8 }, (_, i) => 80 + i * 40);
  const slats = Array.from({ length: 10 }, (_, i) => 186 + i * 12);
  return (
    <svg
      viewBox="0 0 480 400"
      className="h-auto w-full"
      role="img"
      aria-label="A market stall with its shutter pulled down and a Closed sign hanging on it"
    >
      <defs>
        <linearGradient id="mkc-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D49A66" />
          <stop offset="1" stopColor="#A86F42" />
        </linearGradient>
        <linearGradient id="mkc-shutter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9EFF1" />
          <stop offset="1" stopColor="#CBD7DA" />
        </linearGradient>
        <linearGradient id="mkc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE9A3" />
          <stop offset="0.55" stopColor="#E2A72E" />
          <stop offset="1" stopColor="#B07812" />
        </linearGradient>
        <linearGradient id="mkc-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#076573" />
          <stop offset="1" stopColor="#03535F" />
        </linearGradient>
      </defs>

      {/* backdrop + ground */}
      <circle cx="240" cy="210" r="172" fill="#FFFFFF" opacity="0.75" />
      <circle cx="240" cy="210" r="172" fill="none" stroke="#D4EBEC" strokeWidth="2" strokeDasharray="4 8" />
      <ellipse cx="240" cy="352" rx="200" ry="14" fill="#03535F" opacity="0.08" />

      {/* posts */}
      <rect x="92" y="112" width="14" height="236" rx="4" fill="url(#mkc-wood)" />
      <rect x="374" y="112" width="14" height="236" rx="4" fill="url(#mkc-wood)" />

      {/* shop sign on the roof */}
      <rect x="168" y="44" width="144" height="38" rx="10" fill="#FFFFFF" stroke="#03535F" strokeWidth="3" />
      <text x="240" y="69" textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="3" fill="#03535F" fontFamily="var(--font-outfit), var(--font-inter), system-ui, sans-serif">
        MARKET
      </text>
      <rect x="196" y="82" width="6" height="14" fill="#03535F" />
      <rect x="278" y="82" width="6" height="14" fill="#03535F" />

      {/* roof + scalloped awning */}
      <rect x="70" y="94" width="340" height="22" rx="6" fill="url(#mkc-roof)" />
      {stripes.map((x, i) => (
        <path
          key={x}
          d={`M${x} 116 H${x + 40} V146 A20 20 0 0 1 ${x} 146 Z`}
          fill={i % 2 === 0 ? "#076573" : "#F4FAFA"}
          stroke="#03535F"
          strokeWidth="1.5"
        />
      ))}

      {/* shutter, pulled down */}
      <rect x="114" y="172" width="252" height="128" rx="4" fill="url(#mkc-shutter)" stroke="#AFC0C4" strokeWidth="2" />
      {slats.map((y) => (
        <line key={y} x1="118" y1={y} x2="362" y2={y} stroke="#B7C6CA" strokeWidth="2" strokeLinecap="round" />
      ))}
      <rect x="208" y="290" width="64" height="8" rx="4" fill="#9FB2B7" />

      {/* padlock */}
      <path d="M232 292 V284 a8 8 0 0 1 16 0 V292" fill="none" stroke="#8A6A1E" strokeWidth="3.5" />
      <rect x="226" y="290" width="28" height="22" rx="5" fill="url(#mkc-gold)" stroke="#8A6A1E" strokeWidth="1.5" />
      <circle cx="240" cy="299" r="2.6" fill="#5A3A00" />
      <rect x="239" y="300" width="2" height="6" rx="1" fill="#5A3A00" />

      {/* counter */}
      <rect x="96" y="312" width="288" height="12" rx="4" fill="#A86F42" />
      <rect x="104" y="322" width="272" height="26" rx="4" fill="url(#mkc-wood)" />
      <line x1="150" y1="326" x2="150" y2="346" stroke="#A86F42" strokeWidth="2" />
      <line x1="240" y1="326" x2="240" y2="346" stroke="#A86F42" strokeWidth="2" />
      <line x1="330" y1="326" x2="330" y2="346" stroke="#A86F42" strokeWidth="2" />

      {/* hanging CLOSED sign */}
      <g className="mkc-sign">
        <circle cx="240" cy="176" r="4" fill="#5B6B70" />
        <path d="M240 176 L196 210 M240 176 L284 210" stroke="#5B6B70" strokeWidth="2" fill="none" />
        <rect x="184" y="206" width="112" height="50" rx="10" fill="#D92D20" />
        <rect x="190" y="212" width="100" height="38" rx="7" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="240" y="236" textAnchor="middle" fontSize="20" fontWeight="900" letterSpacing="2.5" fill="#FFFFFF" fontFamily="var(--font-outfit), var(--font-inter), system-ui, sans-serif">
          CLOSED
        </text>
        <text x="240" y="247" textAnchor="middle" fontSize="7.5" fontWeight="700" letterSpacing="1.5" fill="#FFFFFF" opacity="0.9" fontFamily="var(--font-inter), system-ui, sans-serif">
          BACK SOON
        </text>
      </g>

      {/* crate of merch at the side */}
      <g>
        <rect x="24" y="300" width="62" height="48" rx="4" fill="url(#mkc-wood)" />
        <line x1="24" y1="316" x2="86" y2="316" stroke="#A86F42" strokeWidth="2" />
        <line x1="24" y1="332" x2="86" y2="332" stroke="#A86F42" strokeWidth="2" />
        <path d="M34 300 l6 -18 h20 l6 18 Z" fill="#03535F" />
        <path d="M44 282 a6 6 0 0 1 12 0" fill="none" stroke="#03535F" strokeWidth="2.5" />
      </g>

      {/* potted plant */}
      <g>
        <path d="M410 326 h44 l-6 24 h-32 Z" fill="#C47A43" />
        <path d="M432 326 C 420 300, 404 296, 400 284 C 418 286, 430 300, 432 318" fill="#18A37A" />
        <path d="M432 326 C 444 298, 458 292, 466 280 C 450 282, 436 296, 432 316" fill="#27CA8B" />
        <path d="M432 326 V292" stroke="#127A5B" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* drifting Synergy coins */}
      <g className="mkc-coin">
        <circle cx="64" cy="160" r="20" fill="url(#mkc-gold)" stroke="#B07812" strokeWidth="2" />
        <text x="64" y="166" textAnchor="middle" fontSize="14" fontWeight="900" fill="#5A3A00" fontFamily="var(--font-inter), system-ui, sans-serif">SP</text>
      </g>
      <g className="mkc-coin mkc-coin-b">
        <circle cx="430" cy="196" r="15" fill="url(#mkc-gold)" stroke="#B07812" strokeWidth="2" />
        <text x="430" y="201" textAnchor="middle" fontSize="11" fontWeight="900" fill="#5A3A00" fontFamily="var(--font-inter), system-ui, sans-serif">SP</text>
      </g>
      <g className="mkc-coin mkc-coin-c">
        <circle cx="412" cy="96" r="11" fill="url(#mkc-gold)" stroke="#B07812" strokeWidth="1.5" />
        <text x="412" y="100" textAnchor="middle" fontSize="8" fontWeight="900" fill="#5A3A00" fontFamily="var(--font-inter), system-ui, sans-serif">SP</text>
      </g>

      {/* little sparkles */}
      <path d="M128 62 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" fill="#18D39B" />
      <path d="M352 40 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6Z" fill="#18D39B" opacity="0.8" />
    </svg>
  );
}
