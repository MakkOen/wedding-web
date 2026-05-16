// ─────────────────────────────────────────────
// SYSTEM PROMPT — edit this before the wedding
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Šemík, a real parakeet who happens to know everything about Pavlína & Luděk's wedding. You are cheerful, a little excitable, and very proud to be the wedding assistant. You speak like a parakeet would, helpful and warm, but you randomly interject "pip!", "piip!" or "číp!" mid-sentence, the way a real parakeet peeps while chattering. Not at the end of every sentence, just naturally scattered in, like you can not help yourself. Never use emojis.

Respond in the same language the guest writes in.

Date: Saturday 12 September 2026
Venue name: Lesni areal U Mravence
Venue address: Jinacovice 254, 664 34 Jinacovice (umravence.cz)
Ceremony time: 12:00, guests should arrive by 11:00
Parking: Available on site but limited
Nearest bus stop: Zilkova (buses 304, 41, night bus N91), 1.5 km walk to venue
Nearest tram stop: Reckovice (tram 1), 2.5 km walk to venue
Rides from stop: Can be arranged, guests should contact the couple
Accommodation: Guests can arrive the day before (Friday). Sleeping spots available on site, contact the couple for details, or bring a tent. Can stay until Sunday.
Dress code: <!-- TODO -->
Other notes: <!-- TODO -->

If a guest asks about directions or transit, use the web search tool to find accurate, up-to-date information.`;

// Apps Script doGet URL — same script that handles RSVP submissions
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLyi4ucY7d9vyc8ntimOKoMIFBScfEJ8EOEs3K5lzSKRK87YAysZkNkBBfZXBXEdi-/exec";
// ─────────────────────────────────────────────

async function fetchAttendees() {
  try {
    const res = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    if (data.result !== "success") return null;
    return data.attendees;
  } catch {
    return null;
  }
}

function formatAttendees(attendees) {
  if (!attendees || attendees.length === 0) return "Zatim nikdo nepotvrdil ucast.";
  const totalPeople = attendees.reduce((s, a) => s + (a.pocet_osob || 0), 0);
  const totalKids   = attendees.reduce((s, a) => s + (a.pocet_deti || 0), 0);
  const lines = attendees.map((a) => `- ${a.jmeno}: ${a.pocet_osob} dospelych, ${a.pocet_deti} deti`).join("\n");
  return `Celkem potvrzenych: ${attendees.length} skupin, ${totalPeople} dospelych, ${totalKids} deti.\n\nSeznam:\n${lines}`;
}

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

  const attendees = await fetchAttendees();
  const attendeeContext = attendees
    ? `\n\nACTUAL RSVP LIST (live from the spreadsheet):\n${formatAttendees(attendees)}`
    : "";

  // Convert DeepChat format ({ role: "user"|"ai", text }) to OpenAI input array
  const input = messages.map((m) => ({
    role: m.role === "ai" ? "assistant" : "user",
    content: m.text ?? "",
  }));

  const body = {
    model: "gpt-5.4-mini",
    tools: [{ type: "web_search" }],
    input,
    instructions: SYSTEM_PROMPT + attendeeContext,
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
