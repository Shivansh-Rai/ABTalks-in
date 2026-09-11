import { cva, type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary CTA for light surfaces (dashboard hub, program dashboard) —
 * ABTalks UI Design System v2, clay button.
 * Apply on `<Link>` / `<a>` via className — never `<Button asChild>`.
 *
 * Tokens: fill Primary Teal `#03535F`, hover Secondary Teal `#076573` with a
 * 1px lift and a soft teal shadow, focus a 2px `#03535F` ring at 4px offset.
 * Geometry: Small 36 / 16 / 10, Default 44 / 20 / 12, Large 48 / 24 / 14;
 * Inter 16/20/600 (14/20 at Small).
 */
export const dsButtonVariants = cva(
  cn(
    buttonVariants({ variant: "default" }),
    "border-transparent bg-[#03535F] font-semibold text-white shadow-none",
    "transition-[background-color,transform,box-shadow] duration-200 ease-[var(--ease-spark)]",
    "hover:scale-100 hover:-translate-y-px hover:!bg-[#076573] hover:!text-white hover:shadow-[0_4px_12px_rgba(3,83,95,0.26)]",
    "active:scale-100 active:translate-y-0",
    "[a]:hover:!bg-[#076573] [a]:hover:!text-white",
    "focus-visible:border-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#03535F] focus-visible:ring-0",
    "disabled:!bg-[#E0E0E0] disabled:!text-[#8F8F8F] disabled:opacity-100",
  ),
  {
    variants: {
      size: {
        sm: "h-9 rounded-[10px] px-4 text-sm leading-5",
        default: "h-11 rounded-[12px] px-5 text-base leading-5",
        lg: "h-12 rounded-[14px] px-6 text-base leading-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export type DsButtonVariants = VariantProps<typeof dsButtonVariants>;
