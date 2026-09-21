import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== "admin") {
    redirect("/dashboard");
  }
  return session;
}
