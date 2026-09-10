"use client";

import { useState } from "react";
import { RedeemDialog } from "@/components/marketplace/redeem-dialog";

type Props = {
  itemId: string;
  costSP: number;
  itemTitle: string;
  balance: number;
  imagePath: string | null;
  defaultPhone: string;
  defaultName: string;
  sizeOptions: string[];
};

export function RedeemButton({
  itemId,
  costSP,
  itemTitle,
  balance,
  defaultPhone,
  defaultName,
  sizeOptions,
}: Props) {
  const [open, setOpen] = useState(false);
  const shortfall = costSP - balance;

  if (balance < costSP) {
    return (
      <button
        type="button"
        disabled
        className="h-9 w-full cursor-not-allowed rounded-[10px] bg-[#E0E0E0] text-sm font-semibold text-[#8F8F8F]"
      >
        Need {shortfall} more SP
      </button>
    );
  }

  return (
    <>
      {/* Clay button, Small size (36 / 16 / 10). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 w-full rounded-[10px] bg-[#03535F] px-4 text-sm font-semibold text-white transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#076573] hover:shadow-[0_4px_12px_rgba(3,83,95,0.26)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#03535F]"
      >
        Redeem
      </button>
      <RedeemDialog
        open={open}
        onOpenChange={setOpen}
        itemId={itemId}
        costSP={costSP}
        itemTitle={itemTitle}
        balance={balance}
        defaultPhone={defaultPhone}
        defaultName={defaultName}
        sizeOptions={sizeOptions}
      />
    </>
  );
}
