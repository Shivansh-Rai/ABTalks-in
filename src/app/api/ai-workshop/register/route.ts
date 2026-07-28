import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { workshopSupabase, getWorkshopConfig } from "@/lib/workshop-supabase";
import { sendWorkshopConfirmationEmail } from "@/lib/workshop-email";
import {
  fullDate,
  getRegistrableEvent,
  istTodayKey,
} from "@/components/workshop/events-data";
import { logger } from "@/lib/logger";

const registrationSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  role: z.string().trim().min(1),
  organization: z.string().trim().min(1).nullish(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = registrationSchema.safeParse(await req.json());

    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      return NextResponse.json(
        {
          error:
            field === "email"
              ? "Please enter a valid email address."
              : "Name, email, phone, and role are required.",
        },
        { status: 400 },
      );
    }

    const { name, phone, role, organization } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    // Resolved server-side rather than trusted from the client, so a forged
    // event id can never redirect a signup into another event's table.
    const event = getRegistrableEvent(istTodayKey());
    if (!event?.registrationTable) {
      return NextResponse.json(
        { error: "Registration is closed right now. Check back soon!" },
        { status: 503 },
      );
    }
    const table = event.registrationTable;

    // Duplicates are caught by the table's unique email constraint rather than
    // a pre-check SELECT: RLS gives anon insert-only access, so a read would
    // always come back empty and silently let duplicates through.
    const { error: insertError } = await workshopSupabase
      .from(table)
      .insert({ name, email, phone, role, organization: organization || null });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "You've already registered. Please check your email for the webinar details.",
          },
          { status: 409 },
        );
      }
      logger.error("Workshop registration insert failed", {
        table,
        eventId: event.id,
        code: insertError.code,
        message: insertError.message,
      });
      return NextResponse.json(
        { error: "Failed to save registration. Please try again." },
        { status: 500 },
      );
    }

    // The row is saved at this point. A mail failure must not fail the request,
    // so it is logged and swallowed.
    try {
      const config = await getWorkshopConfig();
      // Date and time come from the event being registered for; the Zoom and
      // WhatsApp links still come from workshop_config.
      await sendWorkshopConfirmationEmail(name, email, {
        ...config,
        webinarDate: fullDate(event.date),
        webinarTime: event.time,
      });
    } catch (emailErr) {
      logger.error("Workshop confirmation email failed", {
        eventId: event.id,
        email,
        message: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json(
      { message: "Registration successful!" },
      { status: 201 },
    );
  } catch (err) {
    logger.error("Workshop registration failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
