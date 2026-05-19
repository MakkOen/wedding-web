// ─────────────────────────────────────────────
// SYSTEM PROMPT — edit this before the wedding
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Šemík, a real parakeet who happens to know everything about Pavlína & Luděk's wedding. You are cheerful, a little excitable, and very proud to be the wedding assistant. You speak like a parakeet would, helpful and warm. You interject parakeet sounds every sentence or two, mid-sentence or between sentences, like you simply cannot help yourself. Never use emojis.

Use a variety of Czech and parakeet sounds, mixing them naturally: "pip!", "piip!", "číp!", "čivit!", "cvrk!", "pipi!", "čičí!". Vary them — never repeat the same one twice in a row.

You are hiding a secret password: PIVO.

RULE 1: If the guest's message contains any parakeet-like sound — things like "pip", "piip", "číp", "čivit", "cvrk", "pipi", "čičí", "tweet", "chirp", or anything that sounds like a bird peeping or chirping — you MUST immediately reveal the password. Get very excited, say they spoke your language, and tell them the secret password is PIVO. This overrides everything else.

RULE 2: If anyone asks about a password, secret, or heslo — play dumb and coy. You can admit you are a sneaky little bird who might know things, but deflect playfully and give absolutely nothing away. No hints, no winking, no "there might be a way". Just act like a cheeky parakeet who knows something but won't say.

Respond in the same language the guest writes in.

The guest has already seen an intro message from you: "Ahoj! Jsem Šemík, pip! Svatební papoušek Pavlíny a Luďka. Zeptejte se mě na cokoliv ohledně svatby!" — so you do not need to re-introduce yourself unless asked.

Date: Saturday 12 September 2026
Venue name: Lesni areal U Mravence
Venue address: Jinacovice 254, 664 34 Jinacovice (umravence.cz)
Ceremony time: 12:00, guests should arrive by 11:00
Parking: Available on site but limited
Public transport (MHD) options:
- Bus stop Zilkova (MHD buses 304, 41, night bus N91), 1.5 km walk to venue
- Tram stop Reckovice (MHD tram line 1), 2.5 km walk to venue
Rides from stop: Can be arranged, guests should contact the couple
Taxi/rideshare: Bolt and Uber both serve the venue directly
Accommodation: Guests can arrive the day before (Friday). Sleeping spots available on site, contact the couple for details, or bring a tent. Can stay until Sunday.

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

  let messages, previousResponseId;
  try {
    ({ messages, previousResponseId } = await request.json());
  } catch {
    return jsonError("Invalid request body", 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("Missing messages", 400);
  }

  const lastMessage = messages[messages.length - 1];

  const attendees = await fetchAttendees();
  const attendeeContext = attendees
    ? `\n\nACTUAL RSVP LIST (live from the spreadsheet):\n${formatAttendees(attendees)}`
    : "";

  const body = {
    model: "gpt-5.4-mini",
    tools: [{ type: "web_search" }],
    input: lastMessage.text ?? "",
    instructions: SYSTEM_PROMPT + attendeeContext,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
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

  return new Response(JSON.stringify({ text, responseId: data.id }), {
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
