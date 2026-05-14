import { AppShell } from "@/components/app/app-shell";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <AppShell session={session}>{children}</AppShell>;
}
