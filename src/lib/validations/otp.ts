import { z } from "zod";
import { INDIA_DIALING_CODE, indianMobileNumberSchema } from "@/lib/validations/phone";

/**
 * Input for `verifyOtpAction`.
 * - Live mode: the MSG91 widget verifies the OTP client-side and returns an
 *   `accessToken` (JWT) which we validate server-side.
 * - Dev-bypass mode: no widget, so a raw 4-digit `otp` is checked against the
 *   fixed dev code instead.
 * Exactly one of `accessToken` / `otp` is required, and only `+91` is eligible.
 */
export const otpVerifySchema = z
  .object({
    countryCode: z.string(),
    phoneNumber: z.string(),
    accessToken: z.string().optional(),
    otp: z
      .string()
      .regex(/^\d{4}$/, "Enter the 4-digit code")
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.countryCode !== INDIA_DIALING_CODE) {
      ctx.addIssue({
        code: "custom",
        message: "OTP verification is only available for Indian (+91) numbers.",
        path: ["countryCode"],
      });
      return;
    }
    const mobile = indianMobileNumberSchema.safeParse(val.phoneNumber);
    if (!mobile.success) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid 10-digit Indian mobile number",
        path: ["phoneNumber"],
      });
    }
    if (!val.accessToken && !val.otp) {
      ctx.addIssue({
        code: "custom",
        message: "Missing verification token.",
        path: ["accessToken"],
      });
    }
  });

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
