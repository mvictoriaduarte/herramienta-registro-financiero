import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "finanzas_session";

export type SessionPayload = {
  userId: string;
  username: string;
  role: "admin" | "user";
};

function getSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("Falta AUTH_SECRET en el entorno.");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.userId || !payload.username) {
      return null;
    }

    return {
      userId: String(payload.userId),
      username: String(payload.username),
      role: payload.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}
