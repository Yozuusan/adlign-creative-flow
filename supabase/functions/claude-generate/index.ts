import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { product_url, creative_base64, creative_mime, language = "fr", brand, desired_elements } = await req.json();

    if (!product_url) {
      return new Response(JSON.stringify({ error: "product_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch product page content
    let productText = "";
    try {
      const r = await fetch(product_url, { headers: { "User-Agent": "AdlignBot/1.0" } });
      const html = await r.text();
      productText = stripHtml(html).slice(0, 20000); // keep within prompt limits
    } catch (e) {
      console.error("Failed to fetch product URL", e);
    }

    const system = `Tu es un copywriter e-commerce expert. Analyse la page produit et la créative pour proposer un mapping dynamique d'éléments de copy adaptés à la créative. 
- Garde le ton ${language === "fr" ? "français" : language}. 
- Retourne un JSON compact avec: elements: [ { key, label, original, ai, enabled } ]
- key: identifiant machine unique en kebab-case
- label: titre lisible (FR)
- original: texte brut extrait de la page produit (ou "")
- ai: proposition IA optimisée pour la créative
- enabled: true si tu recommandes de remplacer l'original par ai
- Limite chaque ai à 200 caractères quand c'est un titre/CTA, 400-600 pour descriptions.
- N'invente pas de bénéfices non présents si c'est sensible (ingrédients, claims légaux).`;

    const userParts: any[] = [
      {
        type: "text",
        text: `Page produit: ${product_url}\n\nExtrait: ${productText.slice(0, 4000)}`,
      },
    ];

    if (creative_base64 && creative_mime) {
      userParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: creative_mime,
          data: creative_base64,
        },
      });
    }

    if (brand) {
      userParts.push({ type: "text", text: `Contrainte marque: ${brand}` });
    }

    if (desired_elements && Array.isArray(desired_elements) && desired_elements.length > 0) {
      userParts.push({
        type: "text",
        text: `Types d'éléments souhaités (indicatifs): ${desired_elements.join(", ")}`,
      });
    }

    // Ask for a tight JSON
    userParts.push({
      type: "text",
      text: `Réponds UNIQUEMENT avec un JSON de la forme:\n{\n  "elements": [\n    {"key":"headline","label":"Titre principal","original":"…","ai":"…","enabled":true}\n  ]\n}`,
    });

    const body = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1200,
      temperature: 0.7,
      system,
      messages: [
        {
          role: "user",
          content: userParts,
        },
      ],
    } as const;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Anthropic error", resp.status, t);
      return new Response(JSON.stringify({ error: "Anthropic error", details: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // Anthropic returns content array with type=text
    const text = data?.content?.[0]?.text || "";

    // Try to parse JSON safely
    let parsed: any = null;
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const jsonStr = start >= 0 && end >= 0 ? text.slice(start, end + 1) : text;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Claude", e, text);
      return new Response(JSON.stringify({ error: "Bad JSON from model", raw: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("claude-generate error", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
