import "dotenv/config";
import fs from "fs";
import OpenAI from "openai";

async function run() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in GitHub Secrets or .env");
  }

  const client = new OpenAI({ apiKey });

  // aktuelles Datum für saisonale Inhalte
  const today = new Date().toISOString().slice(0, 10);

  // Prompt für deinen Newsletter
  const prompt = `
Erstelle einen wöchentlichen Newsletter ausschließlich als reines JSON-Objekt.

Aktuelles Datum: ${today}
Nutze dieses Datum, um die passende Jahreszeit für Microgreens, Hanfsprossen, Keimlinge und Substratempfehlungen zu bestimmen.

Thema:
Microgreens, Hanf, saisonale Sorten, optimale Substratstärken, Lichtbedingungen, Keimtipps, häufige Fehler und kulinarische Verwendung.

Format:
Gib NUR dieses JSON zurück:

{
  "title": "string – deutscher kurzer Titel",
  "summary": "string – kurze Zusammenfassung",
  "content": "string – ausführlicher deutscher Text (3–6 Absätze) basierend auf der Saison"
}

Regeln:
- Keine Markdown-Formatierung.
- Keine Backticks.
- Nur das JSON-Objekt.
- Inhalt vollständig auf Deutsch.
- Saison abhängig vom Datum.
- Inhalte sollen jede Woche variieren.
`;

  // Anfrage an OpenAI
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  let raw = completion.choices[0].message.content.trim();

  // Markdown-Schutz, falls Modell trotzdem ```json zurückgibt
  raw = raw.replace(/```json/gi, "");
  raw = raw.replace(/```/g, "");
  raw = raw.trim();

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("❌ JSON konnte nicht geparst werden. Rohdaten:\n", raw);
    throw err;
  }

  // Neues RSS-Item
  const newItem = `
    <item>
      <title><![CDATA[${data.title}]]></title>
      <description><![CDATA[${data.summary}]]></description>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <guid isPermaLink="false">${Date.now()}</guid>
      <content:encoded><![CDATA[${data.content}]]></content:encoded>
    </item>
`;

  const feedPath = "feed.xml";
  let oldFeed = "";

  // bestehendes RSS laden
  if (fs.existsSync(feedPath)) {
    oldFeed = fs.readFileSync(feedPath, "utf-8");
  }

  // Wenn kein feed existiert → neuen erstellen
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
    console.log("✅ Neuer RSS-Feed erstellt!");
    return;
  }

  // bestehendes RSS erweitern
  const updatedRSS = oldFeed.replace(
    /<\/channel>\s*<\/rss>/,
    `${newItem}\n  </channel>\n</rss>`
  );

  fs.writeFileSync(feedPath, updatedRSS);
  console.log("✅ Neuer Eintrag zum RSS hinzugefügt!");
}

run().catch(console.error);
