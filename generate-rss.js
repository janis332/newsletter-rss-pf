import "dotenv/config";
import fs from "fs";
import OpenAI from "openai";

async function run() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in .env");
  }

  const client = new OpenAI({ apiKey });

  const today = new Date().toISOString().slice(0, 10);

  // --- REQUEST CONTENT FROM AI ---
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `
Erstelle einen wöchentlichen Newsletter ausschließlich als reines JSON-Objekt.

Aktuelles Datum: ${today}
Nutze dieses Datum, um die passende Jahreszeit und damit saisonale Empfehlungen abzuleiten.

Thema:
Microgreens, Keimlinge, Hanfsprossen, saisonale Sorten, Substratstärken, Licht- & Temperaturtipps, Keimung, Fehlerquellen, kulinarische Anwendungen.

FORMAT — GIB NUR FOLGENDES JSON OBJEKT AUS:

{
  "title": "kurzer deutscher Titel",
  "subtitle": "ein kurzer deutscher Untertitel",
  "summary": "1–2 Sätze Zusammenfassung",
  "content": "HTML-Inhalt (siehe erlaubte Tags)"
}

HTML-REGELN (sehr wichtig — MailerLite erlaubt nur diese!):
ERLAUBTE TAGS:
- <p>
- <strong>
- <em>
- <br>
- <ul>
- <li>

EMOJIS ERLAUBT ✔

NICHT ERLAUBT (NICHT BENUTZEN):
- <h1> bis <h6>
- <div>
- <span>
- <style>
- <img>
- keine Klassen, kein CSS

CONTENT-ANWEISUNGEN:
- HTML unbedingt nur mit erlaubten Tags erzeugen.
- 3–6 Absätze + gerne ein <ul><li>-Block.
- Überschriften bitte als:
  <p><strong>Mein Titel</strong></p>
- KEINE Markdown-Formatierung.
- KEINE Backticks.
- GIB NUR DAS JSON OBJEKT AUS — NICHTS ANDERES.
`
      }
    ]
  });

  let raw = completion.choices[0].message.content.trim();

  // Remove accidental Markdown fences
  raw = raw.replace(/```json/gi, "");
  raw = raw.replace(/```/g, "");
  raw = raw.trim();

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse JSON. Raw response:\n", raw);
    throw err;
  }

  // --- BUILD NEWSLETTER ITEM ---
  const newItem = `
    <item>
      <title><![CDATA[${data.title}]]></title>
      <description><![CDATA[${data.summary}]]></description>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <guid isPermaLink="false">${Date.now()}</guid>
      <content:encoded><![CDATA[
        <p><strong>${data.subtitle}</strong></p>
        ${data.content}
      ]]></content:encoded>
    </item>
`;

  // --- LOAD EXISTING feed.xml ---
  const feedPath = "feed.xml";
  let oldFeed = "";

  if (fs.existsSync(feedPath)) {
    oldFeed = fs.readFileSync(feedPath, "utf-8");
  }

  // --- CREATE NEW RSS IF NONE EXISTS ---
  if (!oldFeed) {
    const freshRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Weekly Newsletter</title>
    <link>https://janis332.github.io/newsletter-rss-pf/</link>
    <description>Automatically generated newsletter</description>
${newItem}
  </channel>
</rss>`;

    fs.writeFileSync(feedPath, freshRSS);
    console.log("Created NEW RSS feed with first entry!");
    return;
  }

  // --- APPEND NEW ITEM ---
  const updatedRSS = oldFeed.replace(
    /<\/channel>\s*<\/rss>/,
    `${newItem}\n  </channel>\n</rss>`
  );

  fs.writeFileSync(feedPath, updatedRSS);
  console.log("Appended new newsletter to feed.xml!");
}

run().catch(console.error);

