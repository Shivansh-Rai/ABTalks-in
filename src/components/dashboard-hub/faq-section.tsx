import { FaqAccordion } from "@/components/shared/faq-accordion";
import { DASHBOARD_FAQ } from "./faq-content";

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <h2 className="font-display text-xl font-semibold text-black">FAQ</h2>
      <div className="mt-4 [&_*]:border-neutral-200 [&_*]:bg-white [&_*]:text-black [&_.text-muted-foreground]:text-neutral-500 [&_.text-foreground]:text-black">
        <FaqAccordion items={DASHBOARD_FAQ} />
      </div>
    </section>
  );
}
