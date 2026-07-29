import { z } from "zod";
import { CERT_ID_PATTERN } from "@/features/certificate/constants";

export const certificateIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(CERT_ID_PATTERN, "Invalid certificate ID format");
