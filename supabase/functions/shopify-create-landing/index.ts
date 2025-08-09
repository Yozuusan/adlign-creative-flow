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
  } catch (e) {
    return null;
  }
}

async function setJsonMetafield(graphql: any, ownerId: string, mapping: any) {
  return await graphql(
    `mutation setMeta($metafields: [MetafieldsSetInput!]!){
      metafieldsSet(metafields: $metafields){
        metafields { id key namespace }
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId,
          namespace: "adlign",
          key: "mapping_json",
          type: "json",
          value: JSON.stringify(mapping ?? {}),
        },
      ],
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_url, mapping, language } = await req.json();

    const storeDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const adminToken = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");

    if (!storeDomain || !adminToken) {
      return new Response(
        JSON.stringify({ error: "Missing Shopify secrets. Please set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!product_url) {
      return new Response(JSON.stringify({ error: "product_url is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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

    // 1) Get product by handle
    const dataProd = await graphql(
      `query productByHandle($handle: String!){ productByHandle(handle:$handle){ id title handle onlineStoreUrl } }`,
      { handle }
    );
    const product = dataProd?.productByHandle;
    if (!product?.id) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2) Ensure metaobject definition exists (best effort)
    let hasDefinition = false;
    try {
      const def = await graphql(
        `query { metaobjectDefinitions(first: 1, type: "adlign_mapping"){ nodes { id name type } } }`
      );
      const nodes = def?.metaobjectDefinitions?.nodes ?? [];
      hasDefinition = nodes.length > 0;
    } catch (e) {
      console.warn("Failed to read metaobject definitions", e);
    }

    if (!hasDefinition) {
      try {
        await graphql(
          `mutation define($def: MetaobjectDefinitionCreateInput!){
            metaobjectDefinitionCreate(definition: $def){
              metaobjectDefinition { id name type }
              userErrors { field message }
            }
          }`,
          {
            def: {
              name: "Adlign Mapping",
              type: "adlign_mapping",
              fieldDefinitions: [
                { name: "Product ID", key: "productId", type: "single_line_text_field", required: true },
                { name: "Language", key: "language", type: "single_line_text_field", required: false },
                { name: "Mapping JSON", key: "mapping", type: "multi_line_text_field", required: true },
              ],
            },
          }
        );
      } catch (e) {
        console.warn("metaobjectDefinitionCreate failed (continuing)", e);
      }
    }

    // 3) Create metaobject instance
    let metaobjectId: string | undefined;
    try {
      const created = await graphql(
        `mutation createMeta($input: MetaobjectCreateInput!){
          metaobjectCreate(metaobject: $input){
            metaobject { id handle type }
            userErrors { field message }
          }
        }`,
        {
          input: {
            type: "adlign_mapping",
            fields: [
              { key: "productId", value: product.id },
              { key: "language", value: language || "" },
              { key: "mapping", value: JSON.stringify(mapping ?? {}) },
            ],
          },
        }
      );
      metaobjectId = created?.metaobjectCreate?.metaobject?.id;
    } catch (e) {
      console.warn("metaobjectCreate failed", e);
    }

    // 4) Create a new Online Store page using the "adlign" template
    const uniqueHandle = `adlign-${product.handle}-${Date.now()}`;
const pageRes = await graphql(
  `mutation createPage($page: PageCreateInput!){
    pageCreate(page: $page){
      page { id handle title }
      userErrors { field message }
    }
  }`,
  {
    page: {
      title: `${product.title} • Adlign Landing`,
      handle: uniqueHandle,
      bodyHtml: "",
      templateSuffix: "adlign",
      published: true,
    },
  }
);
const pageErrors = pageRes?.pageCreate?.userErrors || [];
if (pageErrors.length) {
  throw new Error(
    "Page create error: " + pageErrors.map((e: any) => e?.message || JSON.stringify(e)).join("; ")
  );
}
const page = pageRes?.pageCreate?.page;
if (!page?.id) throw new Error("Failed to create page");

    // 5) Attach metaobject reference or JSON fallback
    if (metaobjectId) {
      try {
const metaSetRes = await graphql(
  `mutation setMeta($metafields: [MetafieldsSetInput!]!){
    metafieldsSet(metafields: $metafields){
      metafields { id key namespace }
      userErrors { field message }
    }
  }`,
  {
    metafields: [
      {
        ownerId: page.id,
        namespace: "adlign",
        key: "mapping_ref",
        type: "metaobject_reference",
        value: metaobjectId,
      },
    ],
  }
);
const metaSetErrors = metaSetRes?.metafieldsSet?.userErrors || [];
if (metaSetErrors.length) {
  throw new Error(
    "Metafields set error: " + metaSetErrors.map((e: any) => e?.message || JSON.stringify(e)).join("; ")
  );
}
      } catch (e) {
        console.warn("Failed to set metaobject reference, falling back to JSON", e);
        await setJsonMetafield(graphql, page.id, mapping);
      }
    } else {
      await setJsonMetafield(graphql, page.id, mapping);
    }

    const response = {
      product: { id: product.id, handle: product.handle },
      page: { id: page.id, handle: page.handle, url: page.onlineStoreUrl ?? `https://${storeDomain}/pages/${page.handle}` },
      metaobjectId,
    };

    return new Response(JSON.stringify(response), {
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
