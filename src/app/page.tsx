import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const dest =
    user.role === "student" ? "/student" : user.role === "guard" ? "/guard" : user.role === "warden" ? "/warden" : "/admin";
  redirect(dest);
}
