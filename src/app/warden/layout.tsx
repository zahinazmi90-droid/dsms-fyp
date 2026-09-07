import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { TopBar } from "@/components/TopBar";
import { ROLE_TITLE, ROLE_NAV } from "@/lib/nav";

export default async function WardenLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("warden", "admin");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={ROLE_TITLE.warden} links={ROLE_NAV.warden} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
