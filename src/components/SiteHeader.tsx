import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
          Axid AI
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" activeOptions={{ exact: true }} className="px-3 py-1.5 text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-1.5 text-foreground" }}>
            Home
          </Link>
          <Link to="/about" className="px-3 py-1.5 text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-1.5 text-foreground" }}>
            About
          </Link>
          <Link to="/chat" className="px-3 py-1.5 text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-1.5 text-foreground" }}>
            Chat
          </Link>
          {user ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="sm" variant="secondary">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}