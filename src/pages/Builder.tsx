import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import DynamicMapper from "@/components/builder/DynamicMapper";
import type { DynamicElement } from "@/hooks/useClaudeGenerate";
import { supabase } from "@/integrations/supabase/client";

// Mock mapping
const defaultMapping = {
  headline: "Default product headline",
  subhead: "Short benefit-driven subhead",
  description: "A longer description that covers features and benefits.",
  images: ["https://picsum.photos/seed/1/800/600"],
  cta: "Add to cart",
};

type Variant = { id: string; value: string; approved?: boolean };

type Page = { id: string; name: string; variants: Record<string, string> };

const Builder = () => {
  const [mapping] = useState(defaultMapping);
  const [files, setFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant[]>>({
    headline: [],
    subhead: [],
    description: [],
    cta: [],
  });
  const [pages, setPages] = useState<Page[]>([]);
  const [dynamicElements, setDynamicElements] = useState<DynamicElement[]>([]);
  const [productUrl, setProductUrl] = useState("");
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  };

  const generate = () => {
    // Demo generation based on uploaded creative count
    const count = Math.max(1, files.length);
    const newVars: Record<string, Variant[]> = { ...variants };
    newVars.headline = Array.from({ length: count }).map((_, i) => ({
      id: `h${i+1}`,
      value: `High-converting headline ${i + 1}`,
    }));
    newVars.subhead = Array.from({ length: count }).map((_, i) => ({
      id: `s${i+1}`,
      value: `Benefit-forward subhead ${i + 1}`,
    }));
    newVars.description = Array.from({ length: count }).map((_, i) => ({
      id: `d${i+1}`,
      value: `Detailed persuasive description variant ${i + 1}.`,
    }));
    newVars.cta = [
      { id: "c1", value: "Add to cart" },
      { id: "c2", value: "Buy now" },
      { id: "c3", value: "Shop the set" },
    ];
    setVariants(newVars);
    toast("Variants generated from creatives.");
  };

  const createPage = () => {
    const firsts: Record<string, string> = {
      headline: variants.headline[0]?.id || "",
      subhead: variants.subhead[0]?.id || "",
      description: variants.description[0]?.id || "",
      cta: variants.cta[0]?.id || "",
    };
    const page: Page = {
      id: `p${pages.length + 1}`,
      name: `Landing Variant ${pages.length + 1}`,
      variants: firsts,
    };
    setPages((p) => [page, ...p]);
    toast("Page created");
  };

  const createPageFromDynamic = async () => {
    const kv: Record<string, string> = {};
    dynamicElements.forEach((el, idx) => {
      const key = el.key || `el-${idx + 1}`;
      const val = el.enabled ? (el.ai || "") : (el.original || "");
      if (val) kv[key] = val;
    });

    if (!productUrl || !productUrl.trim()) {
      toast("Veuillez renseigner l'URL produit dans le bloc 'Mapping dynamique'");
      return;
    }

try {
  const { data, error } = await supabase.functions.invoke("shopify-create-landing", {
    body: { product_url: productUrl, language: "fr", mapping: kv },
  });
  if (error) {
    let details = (error as any)?.message || (error as any)?.error;
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        details = body?.error || body?.message || JSON.stringify(body);
      } catch {
        try {
          const txt = await ctx.text?.();
          if (txt) details = txt;
        } catch {}
      }
    }
    throw new Error(details || "Edge function error");
  }
  const url = data?.page?.url as string | undefined;
  toast(url ? `Page Shopify créée: ${url}` : "Page Shopify créée");
} catch (e: any) {
  const msg = e?.message || e?.error || "échec de création";
  toast(`Erreur Shopify: ${msg}`);
}
  };

  const section = (key: keyof typeof variants, label: string) => (
    <Card key={key}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{label}</span>
          <Badge variant="secondary">Mapped</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Current: {String((mapping as any)[key])}
        </div>
        <div className="space-y-2">
          {variants[key].length === 0 ? (
            <div className="text-sm text-muted-foreground">No variants yet.</div>
          ) : (
            variants[key].map((v) => (
              <div key={v.id} className="flex items-center gap-3">
                <Input value={v.value} onChange={(e)=>{
                  setVariants((prev)=>({
                    ...prev,
                    [key]: prev[key].map((x)=> x.id===v.id ? { ...x, value: e.target.value } : x)
                  }))
                }} />
                <Button
                  variant={v.approved ? "default" : "secondary"}
                  onClick={()=>{
                    setVariants((prev)=>({
                      ...prev,
                      [key]: prev[key].map((x)=> x.id===v.id ? { ...x, approved: !x.approved } : x)
                    }))
                  }}
                >{v.approved ? "Approved" : "Approve"}</Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  const canCreate = useMemo(() => Object.values(variants).every((arr)=>arr.length>0), [variants]);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Variant & Page Builder — Adlign</title>
        <meta name="description" content="Generate and approve variants, compose landing pages." />
        <link rel="canonical" href="/app/builder" />
      </Helmet>

      {/* Dynamic mapping using Claude AI */}
      <DynamicMapper onChange={setDynamicElements} onProductUrlChange={setProductUrl} />


      <div className="grid gap-4 md:grid-cols-2">
        {section("headline", "Headline")}
        {section("subhead", "Subhead")}
        {section("description", "Description")}
        {section("cta", "CTA Label")}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose pages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button disabled={!canCreate} onClick={createPage}>Create page with first variants</Button>
          <Button variant="secondary" className="mt-2" onClick={createPageFromDynamic}
            disabled={productUrl.trim().length === 0 || !dynamicElements.some(el => (((el.enabled ? el.ai : el.original) || "").trim().length > 0))}
          >Créer une page depuis le mapping</Button>
          {pages.length>0 && (
            <div className="space-y-2">
              {pages.map((p)=> (
                <div key={p.id} className="text-sm">
                  {p.name} — Variant params: {Object.entries(p.variants).map(([k,v])=>`${k}:${v}`).join(", ")}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Builder;
