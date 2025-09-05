import { auth } from "./firebaseClient";

export async function authedFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}
