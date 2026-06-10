#!/usr/bin/env node
/**
 * UI image generation via OpenRouter (near-free Gemini image models).
 * Prompts are written in the voice of David Osei, the v5 art-director persona —
 * Condé Nast-level art direction: composition, mood, palette, lens.
 *
 * Usage:  OPENROUTER_API_KEY=sk-or-... node scripts/generate-ui-images.mjs
 * Output: client/public/images/*.png
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "client/public/images");
const MODEL = process.env.IMAGE_MODEL || "google/gemini-3.1-flash-image-preview";
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error("Set OPENROUTER_API_KEY first.");
  process.exit(1);
}

// ── Art direction briefs (David Osei) ───────────────────────────────────────
const BRIEFS = [
  {
    file: "workspace-hero.png",
    prompt:
      "Hyperrealistic editorial photograph, wide 16:9 cinematic banner. A premium journalist's desk in a modern newsroom at golden hour: open silver laptop displaying soft out-of-focus charts, neatly stacked broadsheet newspapers, a black fountain pen resting on a cream notebook with handwritten notes, a double espresso in a white ceramic cup, tortoiseshell reading glasses. Tall windows camera-left pour warm late-afternoon light across the scene; gentle dust motes in the beam. Shallow depth of field (85mm f/1.8 look), warm amber-and-charcoal palette, Kodak Portra film grain, no people, no readable text, no logos. Composition leaves the upper third calm and uncluttered for UI text overlay.",
  },
  {
    file: "login-hero.png",
    prompt:
      "Hyperrealistic moody photograph, 16:9. A vintage letterpress printing press in deep shadow, brass and cast-iron details catching a single warm tungsten key light; fresh broadsheet pages emerging, slightly motion-blurred. Background falls to near-black navy; faint ink mist in the air. Dramatic chiaroscuro, 50mm f/2 look, palette of midnight blue, brass, and warm paper-white. No people, no readable headlines, no logos. Dark enough overall to sit behind a centered login form.",
  },
];

async function generate({ file, prompt }) {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://elitewriter.insightprofit.live",
      "X-Title": "Elite Writer V5 UI",
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ["image", "text"],
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`${file}: HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const images = data.choices?.[0]?.message?.images ?? [];
  const url = images[0]?.image_url?.url ?? "";
  const b64 = url.split("base64,")[1];
  if (!b64) throw new Error(`${file}: no image in response (${JSON.stringify(data).slice(0, 200)})`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, file), Buffer.from(b64, "base64"));
  console.log(`✓ ${file} (${Math.round(b64.length * 0.75 / 1024)} KB)`);
}

for (const brief of BRIEFS) {
  await generate(brief);
}
console.log("Done — images in client/public/images/");
