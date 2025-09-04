import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { TenderDoc } from "./types";

if (!admin.apps.length) {
  admin.initializeApp();
}
export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export const serverTimestamp = () => FieldValue.serverTimestamp();

export const tendersCol = () => db.collection("tenders");
export const matchesCol = () => db.collection("matches");
export const profilesCol = () => db.collection("profiles");

export async function upsertTender(doc: TenderDoc) {
  const ref = tendersCol().doc(doc.id);
  await ref.set(
    {
      ...doc,
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveTenderSummary(
  tenderId: string,
  {
    summary_it,
    summary_en,
  }: { summary_it: string | null; summary_en: string | null }
) {
  await tendersCol()
    .doc(tenderId)
    .set(
      { summary_it, summary_en, updatedAt: serverTimestamp() },
      { merge: true }
    );
}

export async function saveMatchScore(
  companyId: string,
  tenderId: string,
  score: number
) {
  await matchesCol().doc(`${companyId}_${tenderId}`).set(
    {
      companyId,
      tenderId,
      score,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
