import { z } from "zod";
import { candidateRefSchema } from "@/lib/validations/hire-request";

/**
 * The outreach boundary (T-232).
 *
 * Every payload names a candidate or a thread, plus the words. None carries
 * a recruiter id, organization id, candidate user id, email address or
 * recipient: the server derives all of them from the session, and a payload
 * that could name a recipient could name any recipient.
 *
 * `clientRequestId` is generated once per compose in the browser. The database
 * holds it unique per thread, so a retry or a double-click writes one message.
 */

const body = z
  .string()
  .trim()
  .min(1, "Write a message first.")
  .max(5000, "Keep the message under 5,000 characters.");

const clientRequestId = z.string().uuid();

export const sendOutreachSchema = z.object({
  candidateRef: candidateRefSchema,
  // Newlines become spaces: it ends up in an email Subject header.
  subject: z
    .string()
    .trim()
    .max(150, "Keep the subject under 150 characters.")
    .transform((s) => s.replace(/[\r\n]+/g, " ")),
  body,
  clientRequestId,
});

export const threadReplySchema = z.object({
  threadId: z.string().cuid(),
  body,
  clientRequestId,
});

export type SendOutreachInput = z.infer<typeof sendOutreachSchema>;
export type ThreadReplyInput = z.infer<typeof threadReplySchema>;
