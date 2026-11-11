// Fonction « vision » de Basile : identification d'une plante et diagnostic d'une feuille par photo.
// Tourne côté serveur (Supabase Edge Functions, Deno) pour que la clé d'API ne soit jamais dans le front.
//
// Variables d'environnement :
//   ANTHROPIC_API_KEY  clé de l'API Claude
//   BASILE_TOKEN       mot de passe partagé avec l'app (en-tête X-Basile-Token)
//   BASILE_ORIGIN      origine autorisée pour CORS, par ex. https://basile.exemple.be (défaut : *)
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const MAX_IMAGE_CHARS = 6_000_000; // environ 4,5 Mo d'image en base64 ; l'app envoie ~300 Ko

const client = new Anthropic(); // lit ANTHROPIC_API_KEY

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("BASILE_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "content-type, x-basile-token, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const identifySchema = (speciesList: string[]) => ({
  type: "object",
  properties: {
    match: { type: "string", enum: speciesList, description: "L'entrée de la liste qui correspond, sinon « Autre »." },
    common_name: { type: "string", description: "Nom courant en français." },
    latin_name: { type: "string", description: "Nom latin, vide si incertain." },
    confidence: { type: "string", enum: ["élevée", "moyenne", "faible"] },
    summer_days: { type: "integer", description: "Jours entre deux arrosages d'avril à septembre, en intérieur." },
    winter_days: { type: "integer", description: "Jours entre deux arrosages d'octobre à mars, en intérieur." },
    note: { type: "string", description: "Une phrase courte et utile, ou vide." },
  },
  required: ["match", "common_name", "latin_name", "confidence", "summer_days", "winter_days", "note"],
  additionalProperties: false,
});

const diagnoseSchema = {
  type: "object",
  properties: {
    cause: { type: "string", description: "Cause la plus probable, en quelques mots." },
    confidence: { type: "string", enum: ["élevée", "moyenne", "faible"] },
    explanation: { type: "string", description: "Deux ou trois phrases : ce qui se voit sur la photo et pourquoi cette cause." },
    actions: { type: "array", items: { type: "string" }, description: "Deux à quatre gestes concrets, par ordre de priorité." },
  },
  required: ["cause", "confidence", "explanation", "actions"],
  additionalProperties: false,
};

const SYSTEM =
  "Tu aides Basile, une app personnelle d'entretien de plantes d'intérieur. " +
  "Tu réponds en français, en tutoyant, avec des phrases courtes et concrètes. " +
  "Si la photo ne montre pas de plante ou est illisible, dis-le dans la réponse et mets la confiance sur « faible ».";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const expected = Deno.env.get("BASILE_TOKEN") ?? "";
  const given = req.headers.get("x-basile-token") ?? "";
  if (!expected || !sameToken(given, expected)) return json({ error: "auth" }, 401);

  let body: { task?: string; image?: string; context?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "json" }, 400);
  }
  const { task, image } = body;
  const context = body.context ?? {};
  if ((task !== "identify" && task !== "diagnose") || typeof image !== "string" || !image) {
    return json({ error: "request" }, 400);
  }
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "too_large" }, 413);

  let schema: Record<string, unknown>;
  let prompt: string;
  if (task === "identify") {
    const list = Array.isArray(context.species_list)
      ? context.species_list.filter((s): s is string => typeof s === "string").slice(0, 60)
      : [];
    if (!list.includes("Autre")) list.push("Autre");
    schema = identifySchema(list);
    prompt =
      "Identifie la plante sur cette photo. Choisis dans la liste l'entrée qui lui correspond " +
      "(une catégorie comme « Fougère » ou « Succulente » convient si l'espèce en fait partie), sinon « Autre ». " +
      "Donne aussi un rythme d'arrosage réaliste pour cette espèce en pot, en intérieur.";
  } else {
    schema = diagnoseSchema;
    prompt =
      "Voici la photo d'une feuille ou d'une partie abîmée de ma plante. " +
      "Donne la cause la plus probable et quoi faire. Tiens compte du contexte d'entretien ci-dessous, " +
      "en particulier du rythme d'arrosage, de la lumière et de la saison.\n\nContexte :\n" +
      JSON.stringify(context, null, 2).slice(0, 2000);
  }

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Si le modèle décline la demande, l'API la rejoue sur un modèle de repli dans le même appel.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: prompt },
        ],
      }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return json({ error: response.stop_reason }, 502);
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "empty" }, 502);
    return json(JSON.parse(text.text));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "rate_limit" }, 429);
    if (err instanceof Anthropic.BadRequestError) return json({ error: "bad_image" }, 400);
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API", err.status, err.message);
      return json({ error: "upstream" }, 502);
    }
    console.error(err);
    return json({ error: "server" }, 500);
  }
});
