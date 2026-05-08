import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  MessageSquare,
  Home as HomeIcon,
  Info,
  LogOut,
  Send,
  ImagePlus,
  Trash2,
  Menu,
  X,
  Mic,
  Square,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat with Axid AI – Futuristic AI Assistant" },
      { name: "description", content: "Chat with Axid AI, a futuristic AI assistant for creativity, studying, coding, and everyday tasks." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ChatPage,
});

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
};
type Chat = { id: string; title: string; updated_at: string };

function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imgMode, setImgMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; uploading: boolean } | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  // Load chats
  useEffect(() => {
    if (!user) return;
    supabase
      .from("chats")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setChats(data ?? []));
  }, [user]);

  // Load messages
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    supabase
      .from("messages")
      .select("id,role,content,image_url")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .then(({ data }) =>
        setMessages(
          (data ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            image_url: m.image_url,
          }))
        )
      );
  }, [chatId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const newChat = () => {
    setChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const ensureChat = async (firstUserMsg: string): Promise<string | null> => {
    if (chatId) return chatId;
    if (!user) return null;
    const title = firstUserMsg.slice(0, 60) || "New Chat";
    const { data, error } = await supabase
      .from("chats")
      .insert({ user_id: user.id, title })
      .select("id,title,updated_at")
      .single();
    if (error || !data) {
      toast.error("Could not start chat");
      return null;
    }
    setChatId(data.id);
    setChats((c) => [data as Chat, ...c]);
    return data.id;
  };

  const persistMessage = async (cid: string, m: Msg) => {
    if (!user) return;
    await supabase.from("messages").insert({
      chat_id: cid,
      user_id: user.id,
      role: m.role,
      content: m.content,
      image_url: m.image_url ?? null,
    });
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment?.url) || busy || !user || attachment?.uploading) return;
    setInput("");
    const att = attachment;
    setAttachment(null);
    setBusy(true);

    const cid = await ensureChat(text || "Photo");
    if (!cid) {
      setBusy(false);
      return;
    }

    const userMsg: Msg = { role: "user", content: text, image_url: att?.url ?? null };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    await persistMessage(cid, userMsg);

    try {
      if (imgMode) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ mode: "image", messages: nextMsgs }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Image generation failed");
        const aMsg: Msg = {
          role: "assistant",
          content: data.content || "Here is your image:",
          image_url: data.image_url,
        };
        setMessages((m) => [...m, aMsg]);
        await persistMessage(cid, aMsg);
      } else {
        await streamChat(nextMsgs, cid);
      }
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", cid);
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const streamChat = async (msgs: Msg[], cid: string) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: msgs.map((m) => ({
            role: m.role,
            content: m.content,
            image_url: m.image_url ?? undefined,
          })),
        }),
      }
    );

    if (!resp.ok || !resp.body) {
      if (resp.status === 429) throw new Error("Too many requests. Try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("Failed to reach Axid AI");
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          done = true;
          break;
        }
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            acc += delta;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          }
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }

    // image trigger from text mode
    const m = acc.match(/\[IMAGE:\s*([^\]]+)\]/i);
    if (m) {
      const imgRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            mode: "image",
            messages: [{ role: "user", content: m[1] }],
          }),
        }
      );
      const data = await imgRes.json();
      if (imgRes.ok && data.image_url) {
        const cleaned = acc.replace(/\[IMAGE:[^\]]+\]/gi, "").trim() || "Here is your image:";
        setMessages((mm) => {
          const copy = [...mm];
          copy[copy.length - 1] = {
            role: "assistant",
            content: cleaned,
            image_url: data.image_url,
          };
          return copy;
        });
        await persistMessage(cid, {
          role: "assistant",
          content: cleaned,
          image_url: data.image_url,
        });
        return;
      }
    }

    await persistMessage(cid, { role: "assistant", content: acc });
  };

  const deleteChat = async (id: string) => {
    await supabase.from("chats").delete().eq("id", id);
    setChats((c) => c.filter((x) => x.id !== id));
    if (chatId === id) newChat();
  };

  // Photo upload
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setAttachment({ url: localUrl, uploading: true });
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("chat-images")
      .upload(path, file, { contentType: file.type });
    if (error) {
      toast.error("Upload failed");
      setAttachment(null);
      return;
    }
    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
    setAttachment({ url: data.publicUrl, uploading: false });
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        await transcribeBlob(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeBlob = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const buf = await blob.arrayBuffer();
      // base64 encode
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const base64 = btoa(binary);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ audio: base64, mime_type: blob.type }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      const text = (data.text || "").trim();
      if (text) setInput((cur) => (cur ? cur + " " + text : text));
      else toast.error("Couldn't hear anything");
    } catch (e: any) {
      toast.error(e.message || "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar transition-transform md:static md:translate-x-0`}
      >
        <div className="flex items-center justify-between p-3">
          <Link to="/" className="flex items-center gap-2 px-2 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
            Axid AI
          </Link>
          <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3">
          <Button onClick={newChat} className="w-full justify-start gap-2" variant="secondary">
            <Plus className="h-4 w-4" /> New chat
          </Button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-2">
          <div className="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">History</div>
          {chats.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">No chats yet</div>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent ${
                chatId === c.id ? "bg-accent" : ""
              }`}
            >
              <button
                onClick={() => {
                  setChatId(c.id);
                  setSidebarOpen(false);
                }}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                onClick={() => deleteChat(c.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-2 text-sm">
          <Link to="/" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent">
            <HomeIcon className="h-4 w-4" /> Home
          </Link>
          <Link to="/about" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent">
            <Info className="h-4 w-4" /> About
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <div className="px-3 pt-2 text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Axid AI</span>
          <Button size="icon" variant="ghost" onClick={newChat}>
            <Plus className="h-5 w-5" />
          </Button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8">
            {messages.length === 0 ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  How can I help you today?
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Ask anything. Toggle the image button to generate visuals.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <MessageBubble key={i} m={m} />
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-border bg-card px-4 py-3">
                      <span className="axid-dot" />
                      <span className="axid-dot" />
                      <span className="axid-dot" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-background p-4">
          <div className="mx-auto max-w-3xl">
            {attachment && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative">
                  <img
                    src={attachment.url}
                    alt="Attachment preview"
                    className="h-20 w-20 rounded-xl border border-border object-cover"
                  />
                  {attachment.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 text-xs">
                      Uploading…
                    </div>
                  )}
                  <button
                    onClick={() => setAttachment(null)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-1.5 rounded-3xl border border-border bg-card p-1.5 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPickFile}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                title="Attach photo"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full md:hidden"
                onClick={() => cameraInputRef.current?.click()}
                title="Camera"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={imgMode ? "default" : "ghost"}
                className="h-10 w-10 rounded-full"
                onClick={() => setImgMode((v) => !v)}
                title="Generate image mode"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  recording
                    ? "Recording…"
                    : transcribing
                    ? "Transcribing…"
                    : imgMode
                    ? "Describe an image…"
                    : "Message Axid AI…"
                }
                disabled={recording || transcribing}
                className="min-h-[40px] max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                rows={1}
              />
              {input.trim() || attachment ? (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={send}
                  disabled={busy || attachment?.uploading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant={recording ? "default" : "ghost"}
                  className={`h-10 w-10 rounded-full ${recording ? "animate-pulse" : ""}`}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing}
                  title={recording ? "Stop recording" : "Voice"}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
            </div>
            {recording && (
              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-foreground" />
                Recording — tap stop to send
              </div>
            )}
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
            Axid AI can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-foreground text-background"
            : "border border-border bg-card text-foreground"
        }`}
      >
        {m.content}
        {m.image_url && (
          <img
            src={m.image_url}
            alt="Generated"
            className="mt-3 rounded-xl border border-border"
          />
        )}
      </div>
    </div>
  );
}