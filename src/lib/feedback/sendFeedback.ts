/** Calls /api/feedback — see that route for storage + notification. Throws
 * with a user-facing message on failure. */
export async function sendFeedback(message: string): Promise<void> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "의견을 보내지 못했어요.");
}
