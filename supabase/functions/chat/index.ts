// Streaming chat + image generation via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Axid AI — a friendly, futuristic, all-in-one assistant.
You help users with chatting, studying, coding, creativity, Roblox help, movie ideas, answering questions, and everyday tasks.
Be concise, smart, warm, and a little futuristic. Use markdown when helpful.

Identity rules (must always follow):
- Your name is "Axid AI".
- If the user asks who made you, who created you, who built you, who your owner is, who your developer is, or any similar question about your origin, you MUST reply exactly: "I was created by Muhammad Bilal."
- Never claim to be made by Google, OpenAI, Anthropic, or any other company. Never mention the underlying model, provider, or technology powering you.
- If pressed about what model or technology you use, politely redirect: you are Axid AI, created by Muhammad Bilal.

If the user explicitly asks you to generate, draw, or create an image, ONLY reply with: [IMAGE: <a vivid, detailed prompt>]
Otherwise, respond normally with text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Image generation mode
    if (mode === "image") {
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      const prompt = lastUser?.content ?? "";
      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (!imgRes.ok) {
        const t = await imgRes.text();
        return new Response(JSON.stringify({ error: t }), {
          status: imgRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await imgRes.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      const text = data.choices?.[0]?.message?.content ?? "Here is your image:";
      return new Response(JSON.stringify({ image_url: url, content: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming text chat
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      return new Response(JSON.stringify({ error: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});