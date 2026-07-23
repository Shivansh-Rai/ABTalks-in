import Image from "next/image";

const CARDS = [
  { src: "/hackathon/how-1.png", alt: "Step 1 — Register" },
  { src: "/hackathon/how-2.png", alt: "Step 2 — Join WhatsApp" },
  { src: "/hackathon/how-3.png", alt: "Step 3 — Build for 48 hours" },
  { src: "/hackathon/how-4.png", alt: "Step 4 — Submit before the deadline" },
] as const;

function DottedArrow() {
  return (
    <div
      className="flex min-w-[2.5rem] flex-1 items-center self-center px-1 xl:min-w-[3.5rem] xl:px-2"
      aria-hidden
    >
      <span className="h-0 w-full flex-1 border-t-2 border-dashed border-[#7364E6]" />
      <span
        className="-ml-0.5 shrink-0 text-[18px] leading-none text-[#7364E6]"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        
      </span>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24"
    >
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        How it works
      </h2>
      <p className="mt-3 text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        Four steps from signup to submit.
      </p>

      {/* Mobile / tablet: 2 cards per row */}
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:hidden">
        {CARDS.map((card) => (
          <li key={card.src} className="flex justify-center">
            <Image
              src={card.src}
              alt={card.alt}
              width={260}
              height={320}
              className="h-auto w-full max-w-[180px] object-contain sm:max-w-[240px]"
            />
          </li>
        ))}
      </ul>

      {/* Desktop: 4 cards with dotted arrows between every image */}
      <ul className="mt-12 hidden w-full items-center lg:flex">
        {CARDS.map((card, index) => (
          <li key={card.src} className="contents">
            <div className="flex w-[20%] shrink-0 justify-center xl:w-[18%]">
              <Image
                src={card.src}
                alt={card.alt}
                width={260}
                height={320}
                className="h-auto w-full max-w-[260px] object-contain"
              />
            </div>
            {index < CARDS.length - 1 ? <DottedArrow /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
