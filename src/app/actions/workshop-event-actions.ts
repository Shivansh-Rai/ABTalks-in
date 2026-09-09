"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isIconKey } from "@/components/workshop/workshop-icons";
import { uploadPoster } from "@/features/workshop/poster-storage";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Admin CRUD for workshop events.
 *
 * Writing here is the ONLY way a workshop's public content changes. The hero,
 * countdown, calendar tile, sticky date marker and Register/Upcoming banner
 * all read `WorkshopEvent` through `getWorkshopEvents()`, so one save moves
 * every one of them together.
 *
 * `revalidatePath` on each surface is what makes that immediate: `/workshop`
 * and `/dashboard` are dynamic but cached per request, and without an explicit
 * invalidation an admin would save and then not see the change.
 */

type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Splits a textarea into trimmed, non-empty lines. */
const lines = z
  .string()
  .transform((v) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

/**
 * `href` renders directly into an `<a href>` in the replay modal, so the
 * protocol is restricted to http/https. `z.string().url()` alone is NOT
 * enough: it accepts `javascript:alert(1)`, which would execute on click.
 */
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const p = new URL(v).protocol;
      return p === "http:" || p === "https:";
    } catch {
      return false;
    }
  }, "Links must start with http:// or https://.");

const resourceSchema = z.object({
  label: z.string().trim().min(1).max(200),
  href: httpUrl,
  kind: z.enum(["youtube", "link"]),
});

/**
 * `id` is accepted on create and NEVER on update.
 *
 * `WorkshopRegistration.eventId` holds this exact string, and it is the only
 * thing keeping a roster attached to its workshop. Editing one would silently
 * orphan every signup, so the update path does not expose the field at all.
 */
const idSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens (e.g. workshop-2026-10-03).",
  );

const baseSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  time: z.string().trim().min(1).max(60),
  tag: z.string().trim().min(1).max(40),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Accent must be a hex colour like #e05226."),
  icon: z.string().trim().refine(isIconKey, "Unknown icon."),
  title: z.string().trim().min(1).max(200),
  desc: z.string().trim().min(1).max(2000),
  host: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(120),
  registrationOpen: z.boolean(),
  durationMinutes: z.number().int().min(1).max(24 * 60).nullable(),
  /**
   * Either a site-relative path (`/workshop/posters/x.jpg`, how every seeded
   * poster works) or an http(s) URL (what a Blob upload returns). Anything
   * else is rejected: this value becomes an `<img src>`.
   */
  posterSrc: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => {
      if (v.startsWith("/") && !v.startsWith("//")) return true;
      try {
        const p = new URL(v).protocol;
        return p === "http:" || p === "https:";
      } catch {
        return false;
      }
    }, "Poster must be a path like /workshop/posters/name.jpg or an https URL.")
    .nullable(),
  youtubeId: z.string().trim().max(40).nullable(),
  duration: z.string().trim().max(20).nullable(),
  titleAccents: lines,
  topics: lines,
  takeaways: lines,
  resources: z.array(resourceSchema).max(20),
});

const createSchema = baseSchema.extend({ id: idSchema });
const updateSchema = baseSchema.extend({ id: idSchema });

/** Every surface that renders workshop events. */
function revalidateWorkshopSurfaces() {
  revalidatePath("/workshop");
  revalidatePath("/workshop/events");
  revalidatePath("/dashboard");
  revalidatePath("/admin/workshop");
}

export async function createWorkshopEventAction(
  input: unknown,
): Promise<Result<{ id: string }>> {
  await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id, ...rest } = parsed.data;

  const clash = await prisma.workshopEvent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      message: `An event with the id "${id}" already exists. Ids are permanent — pick another.`,
    };
  }

  try {
    await prisma.workshopEvent.create({ data: { id, ...rest } });
  } catch (error) {
    logger.error("createWorkshopEventAction failed", { error: String(error), id });
    return { ok: false, message: "Could not create the event." };
  }

  revalidateWorkshopSurfaces();
  return { ok: true, data: { id } };
}

export async function updateWorkshopEventAction(
  input: unknown,
): Promise<Result<{ id: string }>> {
  await requireAdmin();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id, ...rest } = parsed.data;

  try {
    // `id` is in `where` only — never in `data`. See the note on idSchema.
    await prisma.workshopEvent.update({ where: { id }, data: rest });
  } catch (error) {
    logger.error("updateWorkshopEventAction failed", { error: String(error), id });
    return { ok: false, message: "Could not save the event." };
  }

  revalidateWorkshopSurfaces();
  return { ok: true, data: { id } };
}

/**
 * Deleting an event does NOT delete its registrations — there is no foreign
 * key, by design. The roster stays queryable by `eventId`, and recreating a
 * row under the same id brings the workshop back with its signups intact.
 */
export async function deleteWorkshopEventAction(
  input: unknown,
): Promise<Result> {
  await requireAdmin();

  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid event id." };
  }

  const registrations = await prisma.workshopRegistration.count({
    where: { eventId: parsed.data.id },
  });

  try {
    await prisma.workshopEvent.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    logger.error("deleteWorkshopEventAction failed", {
      error: String(error),
      id: parsed.data.id,
    });
    return { ok: false, message: "Could not delete the event." };
  }

  revalidateWorkshopSurfaces();
  if (registrations > 0) {
    logger.warn("Deleted a workshop event that still had registrations", {
      id: parsed.data.id,
      registrations,
    });
  }
  return { ok: true, data: undefined };
}

/** Uploads a poster and returns its public URL for the form to store. */
export async function uploadWorkshopPosterAction(
  formData: FormData,
): Promise<Result<{ url: string }>> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image first." };
  }

  const result = await uploadPoster(file);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, data: { url: result.url } };
}
