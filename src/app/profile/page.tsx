import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TopBar } from "@/components/TopBar";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ROLE_TITLE, ROLE_NAV } from "@/lib/nav";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Students already have a dedicated profile page with their own details.
  if (user.role === "student") redirect("/student/profile");

  const title = ROLE_TITLE[user.role] ?? user.role;
  const links = ROLE_NAV[user.role] ?? [];

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={title} links={links} />
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-bold text-ink">Profil Saya</h1>
          <p className="text-sm text-ink-soft mt-1">
            {title} · {user.loginId}
          </p>
        </div>
        <ChangePasswordForm />
      </main>
    </div>
  );
}
