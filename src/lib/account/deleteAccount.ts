/** Calls /api/account/delete — see that route for what actually gets
 * removed. Throws with a user-facing message on failure. */
export async function deleteAccount(): Promise<void> {
  const res = await fetch("/api/account/delete", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "탈퇴 처리에 실패했어요.");
}
