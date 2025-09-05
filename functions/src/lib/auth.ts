import * as admin from "firebase-admin";

export async function verifyFirebaseIdToken(authorization?: string) {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer (.+)$/i);
  const idToken = m?.[1];
  if (!idToken) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded?.uid ?? null;
  } catch {
    return null;
  }
}
