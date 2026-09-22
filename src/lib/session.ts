import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: number;
  email?: string;
  isAdmin?: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "aura_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
