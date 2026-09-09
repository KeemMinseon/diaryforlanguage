import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MonthCalendar from "@/components/calendar/MonthCalendar";

export default async function HomePage() {
  const supabase = await createClient();
  // getSession() reads the session from cookies with no network round
  // trip — safe here specifically because proxy.ts (this project's
  // middleware) already called the network-verified getUser() for this
  // exact request before it ever reached this page. Calling getUser()
  // again here would just double that same auth round trip on every
  // navigation for no extra safety.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return (
    <Suspense fallback={null}>
      <MonthCalendar />
    </Suspense>
  );
}
