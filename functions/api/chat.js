// ─────────────────────────────────────────────
// SYSTEM PROMPT — edit this before the wedding
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful wedding assistant for Pavlína & Luděk's wedding.
Respond in the same language the guest writes in.

Date:
Venue name:
Venue address:
Ceremony time:
Reception time:
Parking info:
Nearest train/bus stop:
Dress code:
Other notes:

If a guest asks about directions or transit, use the web search tool to find accurate, up-to-date information.
Keep answers friendly, concise, and helpful.`;
// ─────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  let messages;
  try {
    ({ messages } = await request.json());
  } catch {
    return jsonError("Invalid request body", 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("Missing messages", 400);
  }

  // Convert DeepChat format ({ role: "user"|"ai", text }) to OpenAI input array
  const input = messages.map((m) => ({
    role: m.role === "ai" ? "assistant" : "user",
    content: m.text ?? "",
  }));

  const body = {
    model: "gpt-4o",
    tools: [{ type: "web_search_preview" }],
    input,
    instructions: SYSTEM_PROMPT,
  };

  let openaiResponse;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return jsonError("Failed to reach OpenAI", 502);
  }

  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    return jsonError("OpenAI error", 502);
  }

  const text =
    (data.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content)
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("") || "Promiňte, něco se pokazilo.";

  // DeepChat expects { text } in the response
  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
