import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { TopBar } from "@/components/TopBar";
import { ROLE_TITLE, ROLE_NAV } from "@/lib/nav";

export default async function LecturerLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("lecturer", "admin");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={ROLE_TITLE.lecturer} links={ROLE_NAV.lecturer} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
