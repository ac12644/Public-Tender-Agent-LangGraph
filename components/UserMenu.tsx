"use client";
import * as React from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function UserMenu() {
  const { user, loading, isAnon, signInGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <Button variant="ghost" size="sm" aria-label="Caricamento utente">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user || isAnon) {
    return (
      <Button size="sm" onClick={signInGoogle}>
        Accedi con Google
      </Button>
    );
  }

  const name = user.displayName || user.email || "Account";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{name}</span>
      <Button size="sm" variant="outline" onClick={signOut}>
        Esci
      </Button>
    </div>
  );
}
