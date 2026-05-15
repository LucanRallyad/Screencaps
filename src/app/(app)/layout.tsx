import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  return <AppShell session={session}>{children}</AppShell>;
}
