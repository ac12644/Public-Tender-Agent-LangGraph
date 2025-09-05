import { authedFetch } from "./authedFetch";
const API = process.env.NEXT_PUBLIC_TENDER_API_BASE!;

export type UXEvent =
  | "open_ted"
  | "open_pdf"
  | "favorite_toggle"
  | "open_detail";

export async function trackEvent(
  type: UXEvent,
  tenderId?: string,
  metadata?: Record<string, any>
) {
  try {
    await authedFetch(`${API}/events`, {
      method: "POST",
      body: JSON.stringify({ type, tenderId: tenderId ?? null, metadata }),
    });
  } catch {
    // silenzioso, non bloccare la UI
  }
}
