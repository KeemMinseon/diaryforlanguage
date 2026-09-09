import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StampCollectionView from "@/components/stamps/StampCollectionView";

export default async function StampsPage() {
  const supabase = await createClient();
  // See HomePage — proxy.ts already ran the network-verified getUser()
  // for this request, so a local, no-round-trip getSession() is enough
  // here without doubling that auth check on every navigation.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return <StampCollectionView userId={session.user.id} />;
}
