import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { generateDynamicMapping, DynamicElement, fileToBase64 } from "@/hooks/useClaudeGenerate";
import { toast } from "@/components/ui/sonner";

interface DynamicMapperProps { onChange?: (els: DynamicElement[]) => void; onProductUrlChange?: (url: string) => void }
export default function DynamicMapper({ onChange, onProductUrlChange }: DynamicMapperProps) {
  const [productUrl, setProductUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cachedCreative, setCachedCreative] = useState<{ base64: string; mime: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [elements, setElements] = useState<DynamicElement[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("adlign:lastCreative");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.base64 && parsed?.mime) {
          setCachedCreative({ base64: parsed.base64, mime: parsed.mime, name: parsed.name });
        }
      }
    } catch {}
  }, []);
  const onGenerate = async () => {
    if (!productUrl) {
      toast("Veuillez indiquer l'URL de la page produit");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (file) {
        res = await generateDynamicMapping({ productUrl, creativeFile: file, language: "fr" });
      } else if (cachedCreative) {
        res = await generateDynamicMapping({ productUrl, creativeBase64: cachedCreative.base64, creativeMime: cachedCreative.mime, language: "fr" });
      } else {
        res = await generateDynamicMapping({ productUrl, language: "fr" });
      }
      setElements(res);
      onChange?.(res);
      toast("Proposition IA générée");
    } catch (e: any) {
      toast(`Erreur: ${e.message || "échec génération"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapping dynamique (Claude AI)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="productUrl">URL de la page produit</Label>
            <Input id="productUrl" placeholder="https://votre-boutique.com/products/slug" value={productUrl} onChange={(e)=>{ const v = e.target.value; setProductUrl(v); onProductUrlChange?.(v); }} />
          </div>
          <div className="space-y-2">
            <Label>Créative (optionnel)</Label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) {
                  try {
                    const { base64, mime } = await fileToBase64(f);
                    const payload = { base64, mime, name: f.name, ts: Date.now() };
                    localStorage.setItem("adlign:lastCreative", JSON.stringify(payload));
                    setCachedCreative({ base64, mime, name: f.name });
                    toast("Créative mémorisée");
                  } catch {}
                }
              }}
            />
            {cachedCreative && (
              <div className="text-xs text-muted-foreground">
                Dernière créative mémorisée: {cachedCreative.name || "image"} — réutilisée automatiquement
                <Button variant="link" className="px-1" onClick={() => { localStorage.removeItem("adlign:lastCreative"); setCachedCreative(null); }}>Effacer</Button>
              </div>
            )}
          </div>
        </div>
        <div>
          <Button onClick={onGenerate} disabled={loading || !productUrl.trim()}>{loading ? "Analyse en cours…" : "Analyser & générer"}</Button>
        </div>

        {elements.length > 0 && (
          <div className="space-y-6">
            {elements.map((el, idx) => (
              <div key={el.key || idx} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{el.label}</div>
                    {el.original && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2" title={el.original}>{el.original}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`sw-${idx}`}>Utiliser la version IA</Label>
                    <Switch id={`sw-${idx}`} checked={el.enabled} onCheckedChange={(val)=>{
                      setElements((prev)=>{ const next = prev.map((x,i)=> i===idx ? { ...x, enabled: val } : x); onChange?.(next); return next; });
                    }} />
                  </div>
                </div>
                {el.enabled && (
                  <Textarea value={el.ai} onChange={(e)=>{
                    const v = e.target.value;
                    setElements((prev)=>{ const next = prev.map((x,i)=> i===idx ? { ...x, ai: v } : x); onChange?.(next); return next; });
                  }} />
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={()=>{
                const output = {
                  elements: elements.map(({ key, ai, original, enabled }) => ({ key, value: enabled ? ai : original, enabled })),
                };
                navigator.clipboard.writeText(JSON.stringify(output));
                toast("Mapping copié dans le presse‑papiers");
              }}>Copier le mapping</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
