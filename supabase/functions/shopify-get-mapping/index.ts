import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractHandle(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "products");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
  } catch (_) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { product_url } = await req.json();

    if (!product_url) {
      return new Response(JSON.stringify({ error: "product_url is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const storeDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const adminToken = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");

    if (!storeDomain || !adminToken) {
      return new Response(
        JSON.stringify({ error: "Missing Shopify secrets. Please set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const handle = extractHandle(product_url);
    if (!handle) {
      return new Response(JSON.stringify({ error: "Invalid product_url, cannot extract handle" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const graphql = async (query: string, variables?: Record<string, unknown>) => {
      const res = await fetch(`https://${storeDomain}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        let errMsg = "Shopify GraphQL error";
        try {
          if (Array.isArray(json.errors)) {
            errMsg = json.errors.map((e: any) => e?.message || JSON.stringify(e)).join("; ");
          } else if (typeof json.errors === "string") {
            errMsg = json.errors;
          } else if (json.errors) {
            errMsg = JSON.stringify(json.errors);
          }
        } catch (_) {}
        console.error("Shopify GraphQL error", { status: res.status, body: json, message: errMsg });
        throw new Error(errMsg);
      }
      return json.data;
    };

    const dataProd = await graphql(
      `query productByHandle($handle: String!){
        productByHandle(handle:$handle){
          id
          title
          handle
          metafield(namespace: "adlign_data", key: "settings"){
            id
            type
            value
          }
        }
      }`,
      { handle }
    );

    const product = dataProd?.productByHandle;
    if (!product?.id) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let settings: any | null = null;
    try {
      const raw = product?.metafield?.value;
      if (raw) settings = JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to parse metafield JSON", e);
    }

    const resp = {
      product: { id: product.id, handle: product.handle },
      settings,
      raw: product?.metafield?.value ?? null,
    };

    return new Response(JSON.stringify(resp), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});