import "server-only";
import { logger } from "@/lib/logger";

const VERIFY_ACCESS_TOKEN_URL =
  "https://control.msg91.com/api/v5/widget/verifyAccessToken";

export type Msg91VerifyResult =
  | { ok: true; mobile: string | null }
  | { ok: false; message: string };

type VerifyAccessTokenResponse = {
  type?: string;
  message?: string;
};

/**
 * Verify a MSG91 OTP-widget access token server-side.
 *
 * The widget verifies the OTP in the browser and returns a JWT access token; we
 * confirm that token here with the secret auth key before trusting it. On success
 * MSG91 may echo the verified mobile number in `message` — we surface it so the
 * caller can bind the verification to the exact number.
 */
export async function verifyAccessToken(
  accessToken: string,
): Promise<Msg91VerifyResult> {
  const authkey = process.env.MSG91_AUTH_KEY;
  if (!authkey) {
    logger.warn("[msg91] MSG91_AUTH_KEY missing — cannot verify OTP");
    return { ok: false, message: "OTP service is not configured." };
  }

  try {
    const res = await fetch(VERIFY_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authkey, "access-token": accessToken }),
    });

    const json = (await res.json()) as VerifyAccessTokenResponse;

    if (!res.ok || json.type !== "success") {
      logger.error("[msg91] access token verification failed", {
        status: res.status,
        type: json.type,
      });
      return { ok: false, message: "Could not verify the code. Please try again." };
    }

    // MSG91 returns the verified mobile in `message` on success (E.164 without "+").
    const mobile =
      typeof json.message === "string" && /^\d{7,15}$/.test(json.message.trim())
        ? json.message.trim()
        : null;

    return { ok: true, mobile };
  } catch (e) {
    logger.error("[msg91] verifyAccessToken threw", { error: String(e) });
    return { ok: false, message: "Could not reach the OTP service. Try again." };
  }
}
