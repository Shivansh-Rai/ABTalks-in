import { NextRequest, NextResponse } from "next/server";
import { workshopSupabase } from "@/lib/workshop-supabase";
import { sendWorkshopConfirmationEmail } from "@/lib/workshop-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, role, organization } = body;

    if (!name || !email || !phone || !role) {
      return NextResponse.json(
        { error: "Name, email, phone, and role are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const { data: existing } = await workshopSupabase
      .from("registrations")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "You've already registered. Please check your email for the webinar details." },
        { status: 409 }
      );
    }

    const { error: insertError } = await workshopSupabase
      .from("registrations")
      .insert({ name, email: email.toLowerCase(), phone, role, organization: organization || null });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save registration. Please try again." },
        { status: 500 }
      );
    }

    try {
      await sendWorkshopConfirmationEmail(name, email);
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
    }

    return NextResponse.json({ message: "Registration successful!" }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
