"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { redeemItemAction } from "@/app/actions/marketplace-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  costSP: number;
  itemTitle: string;
  balance: number;
  defaultPhone: string;
};

export function RedeemDialog({
  open,
  onOpenChange,
  itemId,
  costSP,
  itemTitle,
  balance,
  defaultPhone,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shippingAddress, setShippingAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setRecipientPhone(defaultPhone);
      setError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("shippingAddress", shippingAddress);
    formData.set("recipientPhone", recipientPhone);

    startTransition(async () => {
      const result = await redeemItemAction(formData);
      if (result.ok) {
        handleOpenChange(false);
        toast.success("Redeemed! Admin will reach out for fulfillment.");
        router.refresh();
        return;
      }

      if ("reason" in result && result.reason === "validation") {
        setError(result.message);
        return;
      }

      if ("reason" in result && result.reason === "insufficient") {
        setError(result.message);
        return;
      }

      if (
        "reason" in result &&
        (result.reason === "inactive" || result.reason === "not_found")
      ) {
        handleOpenChange(false);
        toast.error(result.message);
        router.refresh();
        return;
      }

      setError(result.message ?? "Something went wrong");
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{itemTitle}</DialogTitle>
          <DialogDescription>
            This will deduct {costSP} SP from your {balance} SP balance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="shippingAddress" className="text-sm font-medium">
              Shipping address
            </label>
            <Textarea
              id="shippingAddress"
              name="shippingAddress"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Full postal address — name, street, city, state, pincode, country"
              disabled={pending}
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="recipientPhone" className="text-sm font-medium">
              Recipient phone
            </label>
            <Input
              id="recipientPhone"
              name="recipientPhone"
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              disabled={pending}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="sm:justify-stretch">
            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-violet-600 hover:bg-violet-500"
            >
              {pending ? "Processing…" : "Confirm Redemption"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
