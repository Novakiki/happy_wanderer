import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "vals-memory-auth";
const LETTER_COOKIE_NAME = "vals-memory-letter";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME);

  if (!authCookie || authCookie.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  cookieStore.set(LETTER_COOKIE_NAME, "seen", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
