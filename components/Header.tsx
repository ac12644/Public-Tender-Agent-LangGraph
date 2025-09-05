"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { Bot, Star, Settings2 } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            <Link
              href="/"
              className="text-lg sm:text-xl font-semibold tracking-tight"
            >
              Tender Agent (Italia)
            </Link>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/preferenze">
                <Settings2 className="h-4 w-4" />
                Preferenze
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/per-te">
                <Star className="h-4 w-4" />
                Per te
              </Link>
            </Button>
            <UserMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
