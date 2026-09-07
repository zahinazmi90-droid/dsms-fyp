import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { TopBar } from "@/components/TopBar";
import { ROLE_TITLE, ROLE_NAV } from "@/lib/nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("student");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={ROLE_TITLE.student} links={ROLE_NAV.student} />
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
