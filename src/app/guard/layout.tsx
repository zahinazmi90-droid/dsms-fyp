import { redirect } from "next/navigation";
import { requireRole, getCurrentUser } from "@/lib/auth/session";
import { TopBar } from "@/components/TopBar";
import { ROLE_TITLE, ROLE_NAV } from "@/lib/nav";

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("guard", "warden", "admin");
  } catch {
    redirect("/login");
  }

  const user = await getCurrentUser();
  const role = user?.role ?? "guard";

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={ROLE_TITLE[role]} links={ROLE_NAV[role]} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
