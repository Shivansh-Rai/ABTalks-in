"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePlatformConfigAction } from "@/app/actions/admin-config-actions";

type ConfigValues = {
  startingGrantMinor: number;
  unlockCostMinor: number;
  mockFreeAllowance: number;
  mockPointCost: number;
};

export function PlatformConfigPanel({ values }: { values: ConfigValues }) {
  const router = useRouter();
  const [startingGrantMinor, setStartingGrantMinor] = useState(
    String(values.startingGrantMinor),
  );
  const [unlockCostMinor, setUnlockCostMinor] = useState(
    String(values.unlockCostMinor),
  );
  const [mockFreeAllowance, setMockFreeAllowance] = useState(
    String(values.mockFreeAllowance),
  );
  const [mockPointCost, setMockPointCost] = useState(String(values.mockPointCost));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    const result = await updatePlatformConfigAction({
      startingGrantMinor: Number(startingGrantMinor),
      unlockCostMinor: Number(unlockCostMinor),
      mockFreeAllowance: Number(mockFreeAllowance),
      mockPointCost: Number(mockPointCost),
      reason: reason.trim(),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Business configuration saved");
    setReason("");
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Business configuration</h2>
        <p className="text-sm text-muted-foreground">
          These numbers apply without a deploy. Existing recruiter balances are
          not rewritten.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cfg-starting">Starting credits (USD cents)</Label>
          <Input
            id="cfg-starting"
            type="number"
            value={startingGrantMinor}
            onChange={(e) => setStartingGrantMinor(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-unlock">Unlock cost (USD cents)</Label>
          <Input
            id="cfg-unlock"
            type="number"
            value={unlockCostMinor}
            onChange={(e) => setUnlockCostMinor(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-free">Free mock allowance</Label>
          <Input
            id="cfg-free"
            type="number"
            value={mockFreeAllowance}
            onChange={(e) => setMockFreeAllowance(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-cost">Mock point cost</Label>
          <Input
            id="cfg-cost"
            type="number"
            value={mockPointCost}
            onChange={(e) => setMockPointCost(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cfg-reason">Reason</Label>
        <Textarea
          id="cfg-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button
        type="button"
        disabled={pending || reason.trim().length < 8}
        onClick={onSave}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
