import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WordListView from "@/components/words/WordListView";

export default async function WordsPage() {
  const supabase = await createClient();
  // See HomePage — proxy.ts already ran the network-verified getUser()
  // for this request, so a local, no-round-trip getSession() is enough
  // here without doubling that auth check on every navigation.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return <WordListView userId={session.user.id} />;
}
