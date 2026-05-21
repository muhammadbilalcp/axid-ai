import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const ADMIN_EMAIL = "muhammadbilalcp@gmail.com";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin – Axid AI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Row = {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "user" | "assistant">("user");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (user.email !== ADMIN_EMAIL) return;
    (async () => {
      setFetching(true);
      const q = supabase
        .from("messages")
        .select("id,chat_id,user_id,role,content,image_url,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const { data, error } = await q;
      if (error) setError(error.message);
      else setRows((data as Row[]) ?? []);
      setFetching(false);
    })();
  }, [user, loading, navigate]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!user) return null;

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          This area is restricted to the site administrator.
        </p>
        <Link to="/" className="mt-4 inline-block underline">
          Go home
        </Link>
      </div>
    );
  }

  const visible = rows.filter((r) => (filter === "all" ? true : r.role === filter));

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            All messages across Axid AI · {visible.length} shown
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-border p-1 text-sm">
          {(["user", "assistant", "all"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 capitalize ${
                filter === k ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {fetching ? (
        <div className="text-muted-foreground">Loading messages…</div>
      ) : visible.length === 0 ? (
        <div className="text-muted-foreground">No messages yet.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-accent px-2 py-0.5 text-foreground">
                  {r.role}
                </span>
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <span className="truncate">user: {r.user_id.slice(0, 8)}…</span>
                <span className="truncate">chat: {r.chat_id.slice(0, 8)}…</span>
              </div>
              {r.image_url && (
                <img
                  src={r.image_url}
                  alt=""
                  className="mb-2 max-h-48 rounded border border-border"
                />
              )}
              <div className="whitespace-pre-wrap break-words text-foreground">
                {r.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}