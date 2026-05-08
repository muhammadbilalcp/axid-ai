// Voice-to-text transcription via Lovable AI Gateway (Gemini multimodal audio input)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audio, mime_type } = await req.json();
    if (!audio) throw new Error("Missing audio");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataUrl = `data:${mime_type || "audio/webm"};base64,${audio}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe the spoken audio to plain text. Return ONLY the transcript, no quotes, no extra words.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});