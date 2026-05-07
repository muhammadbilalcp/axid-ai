import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Axid AI" },
      {
        name: "description",
        content:
          "Learn about Axid AI — an all-in-one futuristic assistant for chat, learning, coding, creativity, and daily tasks.",
      },
      { property: "og:title", content: "About — Axid AI" },
      {
        property: "og:description",
        content: "An all-in-one futuristic AI assistant for everything.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">About Axid AI</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Axid AI is your all-in-one futuristic AI assistant — designed to feel
          calm, professional, and fast. We help you think, build, learn, and
          create.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {[
            { t: "Learning", d: "Summaries, study guides, flashcards, and clear explanations on any subject." },
            { t: "Chatting", d: "Friendly conversation, brainstorming, and ideation whenever you need a partner." },
            { t: "Coding", d: "Write, debug, refactor, and understand code across many languages." },
            { t: "Creativity", d: "Movie ideas, stories, Roblox help, lyrics, image generation and more." },
            { t: "Everyday tasks", d: "Plan trips, draft emails, organize to-dos, and answer quick questions." },
            { t: "Image generation", d: "Just ask Axid to draw or generate an image — it handles the rest." },
          ].map((b) => (
            <div key={b.t} className="bg-background p-6">
              <h2 className="text-base font-medium">{b.t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Link to="/chat">
            <Button size="lg">Start chatting</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}