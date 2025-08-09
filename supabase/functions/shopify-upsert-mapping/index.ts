import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractHandle(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "products");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_url, mapping, language = "fr", variant } = await req.json();

    if (!product_url || !mapping) {
      return new Response(
        JSON.stringify({ error: "Missing product_url or mapping" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const adminToken = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");

    if (!storeDomain || !adminToken) {
      return new Response(
        JSON.stringify({ error: "Missing Shopify credentials (domain or token)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const graphql = async (query: string, variables?: Record<string, unknown>) => {
      const res = await fetch(`https://${storeDomain}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": adminToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        console.error("GraphQL error", json.errors || json);
        throw new Error((json.errors?.[0]?.message as string) || "GraphQL error");
      }
      return json.data;
    };

    const handle = extractHandle(product_url);
    if (!handle) {
      return new Response(
        JSON.stringify({ error: "Invalid product URL - cannot extract handle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product and existing settings metafield
    const productData = await graphql(
      `query productByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          metafield(namespace: "adlign", key: "settings") {
            id
            type
            value
          }
        }
      }`,
      { handle }
    );

    const product = productData?.productByHandle;
    if (!product?.id) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let settings: any = {};
    if (product.metafield?.value) {
      try {
        settings = JSON.parse(product.metafield.value);
      } catch {
        settings = {};
      }
    }

    // Normalize structure: settings.variants[variantId] = { mapping, language }
    const variantId: string = (variant && String(variant)) || "p1";
    if (!settings.variants) settings.variants = {};
    settings.variants[variantId] = { mapping, language };

    const setRes = await graphql(
      `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key namespace type value }
          userErrors { field message }
        }
      }`,
      {
        metafields: [
          {
            ownerId: product.id,
            namespace: "adlign",
            key: "settings",
            type: "json",
            value: JSON.stringify(settings),
          },
        ],
      }
    );

    const userErrors = setRes?.metafieldsSet?.userErrors || [];
    if (userErrors.length) {
      throw new Error(userErrors.map((e: any) => e.message).join("; "));
    }

    return new Response(
      JSON.stringify({ ok: true, product: { id: product.id, handle: product.handle }, variant: variantId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("shopify-upsert-mapping error", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});