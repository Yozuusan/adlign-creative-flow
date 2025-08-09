import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

const Preview = () => {
  const [url, setUrl] = useState("");
  const [variant, setVariant] = useState("p1");

  const previewUrl = useMemo(() => {
    if (!url) return "";
    const u = new URL(url);
    u.searchParams.set("adlign_variant", variant);
    return u.toString();
  }, [url, variant]);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Preview & Test — Adlign</title>
        <meta name="description" content="Live preview your product page with a selected variant." />
        <link rel="canonical" href="/app/preview" />
      </Helmet>

      <Card>
        <CardHeader>
          <CardTitle>Preview setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="https://yourshop.com/products/example" value={url} onChange={(e)=>setUrl(e.target.value)} />
          <Input placeholder="Variant id (e.g. p1)" value={variant} onChange={(e)=>setVariant(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={()=>toast("Applied (no publish)")}>Apply</Button>
            <Button variant="secondary" onClick={()=>toast("Reverted")}>Revert</Button>
          </div>
        </CardContent>
      </Card>

      {previewUrl && (
        <div className="rounded-lg border overflow-hidden">
          <iframe title="Live Preview" src={previewUrl} className="w-full h-[70vh]" />
        </div>
      )}
    </div>
  );
};

export default Preview;
