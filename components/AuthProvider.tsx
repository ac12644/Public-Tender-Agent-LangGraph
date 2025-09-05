"use client";
import * as React from "react";
import type { User } from "firebase/auth";
import {
  auth,
  ensureSignedIn,
  signInWithGoogle,
  signOutUser,
  watchUser,
} from "@/lib/firebaseClient";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAnon: boolean;
  uid: string | null;
  idToken: string | null;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(auth.currentUser ?? null);
  const [loading, setLoading] = React.useState(true);
  const [idToken, setIdToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    // on first load, ensure at least anonymous user exists
    const unsub = watchUser(async (u) => {
      setUser(u);
      setLoading(false);
      setIdToken(u ? await u.getIdToken() : null);
    });

    // if no user after first tick, create anonymous
    (async () => {
      if (!auth.currentUser) {
        try {
          await ensureSignedIn();
        } catch {
          /* noop */
        }
      }
    })();

    return () => unsub && unsub();
  }, []);

  const refreshToken = React.useCallback(async () => {
    if (!user) return;
    setIdToken(await user.getIdToken(true));
  }, [user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAnon: !!user?.isAnonymous,
      uid: user?.uid ?? null,
      idToken,
      signInGoogle: async () => {
        await signInWithGoogle();
      },
      signOut: async () => {
        await signOutUser();
      },
      refreshToken,
    }),
    [user, loading, idToken, refreshToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
