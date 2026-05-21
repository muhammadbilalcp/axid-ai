import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Users,
  MessageSquare,
  Search,
  Trash2,
  Ban,
  ShieldCheck,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

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

type Stats = {
  total_users: number;
  total_messages: number;
  total_chats: number;
  total_blocked: number;
  messages_today: number;
  users_week: number;
};

type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  message_count: number;
  chat_count: number;
  last_message_at: string | null;
  is_blocked: boolean;
};

type Chat = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

type Tab = "stats" | "users" | "chats" | "search";

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!user) return null;

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
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

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        </div>
        <Link
          to="/chat"
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-full border border-border p-1 text-sm">
        {([
          ["stats", "Stats", BarChart3],
          ["users", "Users", Users],
          ["chats", "Chats", MessageSquare],
          ["search", "Search", Search],
        ] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
              tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === "stats" && <StatsPanel />}
      {tab === "users" && <UsersPanel />}
      {tab === "chats" && <ChatsPanel />}
      {tab === "search" && <SearchPanel />}
    </div>
  );
}

/* ---------------- Stats ---------------- */
function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) setErr(error.message);
      else setStats(data as Stats);
    })();
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!stats) return <div className="text-muted-foreground">Loading stats…</div>;

  const cards: { label: string; value: number }[] = [
    { label: "Total users", value: stats.total_users },
    { label: "Total messages", value: stats.total_messages },
    { label: "Total chats", value: stats.total_chats },
    { label: "Blocked users", value: stats.total_blocked },
    { label: "Messages today", value: stats.messages_today },
    { label: "New users (7d)", value: stats.users_week },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-semibold">{c.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) setErr(error.message);
    else setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlock = async (u: AdminUser) => {
    if (u.email === ADMIN_EMAIL) {
      toast.error("You cannot block yourself");
      return;
    }
    if (u.is_blocked) {
      const { error } = await supabase.from("blocked_users").delete().eq("user_id", u.id);
      if (error) return toast.error(error.message);
      toast.success("User unblocked");
    } else {
      const { error } = await supabase.from("blocked_users").insert({ user_id: u.id });
      if (error) return toast.error(error.message);
      toast.success("User blocked");
    }
    load();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(s) ||
        (u.display_name ?? "").toLowerCase().includes(s),
    );
  }, [users, q]);

  if (err) return <ErrorBox message={err} />;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email or name…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading users…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Messages</th>
                <th className="px-3 py-2">Chats</th>
                <th className="px-3 py-2">Last active</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.email}</div>
                    {u.display_name && (
                      <div className="text-xs text-muted-foreground">{u.display_name}</div>
                    )}
                    {u.is_blocked && (
                      <span className="mt-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                        Blocked
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{u.message_count}</td>
                  <td className="px-3 py-2">{u.chat_count}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.last_message_at ? new Date(u.last_message_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleBlock(u)}
                      disabled={u.email === ADMIN_EMAIL}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
                    >
                      <Ban className="h-3 w-3" />
                      {u.is_blocked ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Chats ---------------- */
function ChatsPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) setErr(error.message);
    else setChats((data as Chat[]) ?? []);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const openChat = async (c: Chat) => {
    setActiveChat(c);
    setMessages([]);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", c.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setMessages((data as Message[]) ?? []);
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMessages((m) => m.filter((x) => x.id !== id));
    toast.success("Message deleted");
  };

  const deleteChat = async (c: Chat) => {
    if (!confirm(`Delete chat "${c.title}" and all its messages?`)) return;
    await supabase.from("messages").delete().eq("chat_id", c.id);
    const { error } = await supabase.from("chats").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Chat deleted");
    setActiveChat(null);
    loadChats();
  };

  if (err) return <ErrorBox message={err} />;

  return (
    <div className="grid gap-4 md:grid-cols-[280px,1fr]">
      <aside className="rounded-lg border border-border">
        <div className="border-b border-border p-2 text-xs uppercase text-muted-foreground">
          {chats.length} chats
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {chats.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => openChat(c)}
                className={`block w-full truncate border-b border-border px-3 py-2 text-left text-sm hover:bg-accent ${
                  activeChat?.id === c.id ? "bg-accent" : ""
                }`}
              >
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.updated_at).toLocaleString()} · {c.user_id.slice(0, 8)}…
                </div>
              </button>
            </li>
          ))}
          {chats.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">No chats yet.</li>
          )}
        </ul>
      </aside>

      <section className="rounded-lg border border-border p-3">
        {!activeChat ? (
          <div className="p-6 text-center text-muted-foreground">
            Select a chat to view its messages.
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-2 border-b border-border pb-2">
              <div>
                <div className="font-semibold">{activeChat.title}</div>
                <div className="text-xs text-muted-foreground">
                  user {activeChat.user_id}
                </div>
              </div>
              <button
                onClick={() => deleteChat(activeChat)}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" /> Delete chat
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {messages.map((m) => (
                <MessageRow key={m.id} m={m} onDelete={() => deleteMessage(m.id)} />
              ))}
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground">No messages.</div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------------- Search ---------------- */
function SearchPanel() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const s = q.trim();
    if (!s) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .ilike("content", `%${s}%`)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) return toast.error(error.message);
    setResults((data as Message[]) ?? []);
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setResults((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search message content…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="text-muted-foreground">Searching…</div>
      ) : results.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {q ? "No matches." : "Enter a query to search all messages."}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((m) => (
            <MessageRow key={m.id} m={m} onDelete={() => deleteMessage(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Shared bits ---------------- */
function MessageRow({ m, onDelete }: { m: Message; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-accent px-2 py-0.5 text-foreground">{m.role}</span>
        <span>{new Date(m.created_at).toLocaleString()}</span>
        <span className="truncate">user: {m.user_id.slice(0, 8)}…</span>
        <button
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
      {m.image_url && (
        <img src={m.image_url} alt="" className="mb-2 max-h-48 rounded border border-border" />
      )}
      <div className="whitespace-pre-wrap break-words text-foreground">{m.content}</div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}