const chipClass =
  "inline-flex items-center rounded-[4px] bg-[#E7F2F3] px-2 py-0.5 text-[12px] font-semibold text-[#03535F]";

export function DayHeading({
  dayNumber,
  dayTitle,
  estimatedMin,
  missionPoints,
}: {
  dayNumber: number;
  dayTitle: string;
  estimatedMin: number;
  missionPoints: number;
}) {
  return (
    <header>
      <p className="font-heading text-[13px] leading-[18px] font-semibold uppercase text-[#03535F]">
        Day {dayNumber}
      </p>
      <h1 className="mt-1.5 max-w-3xl font-heading text-xl font-semibold tracking-tight text-[#000000] md:text-2xl">
        {dayTitle}
      </h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={chipClass}>{missionPoints} pts</span>
        <span className={chipClass}>~{estimatedMin} min est.</span>
        <span className={chipClass}>Required</span>
      </div>
    </header>
  );
}
