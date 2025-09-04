import * as admin from "firebase-admin";

let app: admin.app.App | null = null;

export function ensureFirebaseAdmin() {
  if (!app) {
    // In functions, this works without args (uses FIREBASE_CONFIG)
    app = admin.initializeApp();
  }
  return app;
}

export function firestore() {
  ensureFirebaseAdmin();
  return admin.firestore();
}
