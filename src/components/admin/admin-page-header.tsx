import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-9 tracking-tight text-[#353535] md:text-[32px] md:leading-10">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#787878]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
