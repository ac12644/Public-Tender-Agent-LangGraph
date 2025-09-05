"use client";
import * as React from "react";
import {
  ensureSignedIn,
  watchUser,
  signInWithGoogle,
  signOutUser,
} from "@/lib/firebaseClient";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function UserMenu() {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState<ReturnType<typeof Object> | null>(
    null
  );

  React.useEffect(() => {
    ensureSignedIn().finally(() => setReady(true));
    const off = watchUser((u) => setUser(u));
    return () => off();
  }, []);

  if (!ready) {
    return (
      <Button variant="ghost" size="sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button size="sm" onClick={() => signInWithGoogle()}>
        Accedi con Google
      </Button>
    );
  }

  if (user.isAnonymous) {
    return (
      <Button size="sm" onClick={() => signInWithGoogle()}>
        Accedi con Google
      </Button>
    );
  }

  const name = user.displayName || user.email || "Account";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{name}</span>
      <Button size="sm" variant="outline" onClick={() => signOutUser()}>
        Esci
      </Button>
    </div>
  );
}
