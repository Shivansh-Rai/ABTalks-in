"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { z } from "zod";
import { registerRecruiterAction } from "@/app/actions/talent-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recruiterRegisterSchema,
  type RecruiterRegisterInput,
} from "@/lib/validations/talent";

type FormInput = z.input<typeof recruiterRegisterSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive">{message}</p>;
}

export function RecruiterRegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, RecruiterRegisterInput>({
    resolver: zodResolver(recruiterRegisterSchema),
    defaultValues: { fullName: "", company: "", phone: "" },
  });

  async function onSubmit(data: RecruiterRegisterInput) {
    setSubmitting(true);
    try {
      const result = await registerRecruiterAction(data);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Application submitted!");
      router.push("/talent/pending");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" {...register("fullName")} />
        <FieldError message={errors.fullName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input id="company" {...register("company")} />
        <FieldError message={errors.company?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" type="tel" {...register("phone")} />
        <FieldError message={errors.phone?.message} />
      </div>
      <Button type="submit" disabled={submitting} className="w-full gap-2">
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Submit application
      </Button>
    </form>
  );
}
