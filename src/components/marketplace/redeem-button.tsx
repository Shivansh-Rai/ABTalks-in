"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RedeemDialog } from "@/components/marketplace/redeem-dialog";

type Props = {
  itemId: string;
  costSP: number;
  itemTitle: string;
  balance: number;
  imagePath: string | null;
  defaultPhone: string;
};

export function RedeemButton({
  itemId,
  costSP,
  itemTitle,
  balance,
  defaultPhone,
}: Props) {
  const [open, setOpen] = useState(false);
  const shortfall = costSP - balance;

  if (balance < costSP) {
    return (
      <Button
        type="button"
        disabled
        className="w-full bg-zinc-800 text-zinc-500"
      >
        Need {shortfall} more SP
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        className="w-full bg-violet-600 hover:bg-violet-500"
        onClick={() => setOpen(true)}
      >
        Redeem
      </Button>
      <RedeemDialog
        open={open}
        onOpenChange={setOpen}
        itemId={itemId}
        costSP={costSP}
        itemTitle={itemTitle}
        balance={balance}
        defaultPhone={defaultPhone}
      />
    </>
  );
}
