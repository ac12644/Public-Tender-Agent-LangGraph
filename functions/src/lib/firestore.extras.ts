import { db, serverTimestamp } from "./firestore";
import type { UserProfile, SavedSearch, FavoriteTender } from "./models";

export const profilesCol = () => db.collection("profiles");
export const savedSearchesCol = (uid: string) =>
  db.collection("saved_searches").doc(uid).collection("items");
export const favoritesCol = (uid: string) =>
  db.collection("favorites").doc(uid).collection("tenders");

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const doc = await profilesCol().doc(uid).get();
  if (!doc.exists) return null;
  return { uid, ...(doc.data() as any) } as UserProfile;
}

export async function upsertUserProfile(
  uid: string,
  patch: Partial<UserProfile>
) {
  const ref = profilesCol().doc(uid);
  await ref.set(
    {
      uid,
      regions: [],
      cpv: [],
      daysBack: 3,
      notifyMorning: false,
      createdAt: serverTimestamp(),
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  const snap = await ref.get();
  return { uid, ...(snap.data() as any) } as UserProfile;
}

export async function listSavedSearches(uid: string): Promise<SavedSearch[]> {
  const snap = await savedSearchesCol(uid).orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function upsertSavedSearch(
  uid: string,
  body: Omit<SavedSearch, "id" | "uid" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
) {
  const id = body.id || db.collection("_").doc().id;
  const ref = savedSearchesCol(uid).doc(id);
  await ref.set(
    {
      uid,
      ...body,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  const snap = await ref.get();
  return { id: snap.id, ...(snap.data() as any) } as SavedSearch;
}

export async function deleteSavedSearch(uid: string, id: string) {
  await savedSearchesCol(uid).doc(id).delete();
}

export async function toggleFavorite(uid: string, tenderId: string) {
  const ref = favoritesCol(uid).doc(tenderId);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
    return { favorited: false };
  }
  await ref.set({ uid, tenderId, createdAt: serverTimestamp() });
  return { favorited: true };
}

export async function listFavorites(uid: string) {
  const snap = await favoritesCol(uid).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({
    tenderId: d.id,
    ...(d.data() as any),
  })) as FavoriteTender[];
}
