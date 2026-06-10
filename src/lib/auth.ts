import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "worksphere_session";

function sessionSecret() {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("SESSION_SECRET or NEXTAUTH_SECRET is required.");
  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      issuedAt?: number;
    };
    if (!parsed.userId || !parsed.issuedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      managerId: true,
    },
  });
}
