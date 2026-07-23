import Image from "next/image";

const CARDS = [
  { src: "/hackathon/rule-1.png", alt: "Solo or teams of up to 3" },
  { src: "/hackathon/rule-2.png", alt: "Open to Indian college students" },
  { src: "/hackathon/rule-3.png", alt: "Build starts at kickoff" },
  { src: "/hackathon/rule-4.png", alt: "Fair play" },
] as const;

export function Rules() {
  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        Rules
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        Eligibility, team size, and fair play.
      </p>

      <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {CARDS.map((card) => (
          <li key={card.src} className="flex justify-center">
            <Image
              src={card.src}
              alt={card.alt}
              width={332}
              height={324}
              className="h-auto w-full max-w-[332px] object-contain"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
