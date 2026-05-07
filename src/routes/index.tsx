import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Code2, BookOpen, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Axid AI — Your futuristic AI assistant" },
      {
        name: "description",
        content:
          "Axid AI is your futuristic AI assistant for chatting, coding, studying, creativity, and everyday tasks.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
            Now in early access
          </div>
          <h1 className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-6xl font-semibold tracking-tight text-transparent md:text-8xl">
            Axid AI
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Your futuristic AI assistant for everything.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/chat">
              <Button size="lg" className="gap-2 px-6">
                Start Chatting <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="ghost">
                Learn more
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl border-t border-border px-6 py-20">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Sparkles, title: "Chat & answers", desc: "Smart, friendly conversations on anything." },
              { icon: Code2, title: "Code help", desc: "Write, debug, and explain code instantly." },
              { icon: BookOpen, title: "Study & learn", desc: "Notes, summaries and practice questions." },
              { icon: ImageIcon, title: "Image generation", desc: "Bring ideas to life with AI visuals." },
            ].map((f) => (
              <div key={f.title} className="bg-background p-8">
                <f.icon className="h-5 w-5 text-foreground" />
                <h3 className="mt-4 text-base font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Axid AI</span>
            <span>Built for the future.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
