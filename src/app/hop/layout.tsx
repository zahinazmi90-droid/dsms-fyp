import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { TopBar } from "@/components/TopBar";
import { ROLE_TITLE, ROLE_NAV } from "@/lib/nav";

export default async function HopLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("head_of_programme", "admin");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={ROLE_TITLE.head_of_programme} links={ROLE_NAV.head_of_programme} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
