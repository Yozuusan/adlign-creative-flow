import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const Pages = () => {
  const [pages, setPages] = useState([
    { id: "p1", name: "Landing Variant 1", status: "Active", edited: "today" },
    { id: "p2", name: "Landing Variant 2", status: "Draft", edited: "2d ago" },
  ]);

  const snippet = (id: string) => (
    `/* Adlign Variant Loader */\n(function(){\n  var params = new URLSearchParams(window.location.search);\n  params.set('adlign_variant', '${id}');\n  // Optional: fetch personalized elements from your backend and apply\n  console.log('Apply variant', '${id}');\n})();`
  );

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Pages — Adlign</title>
        <meta name="description" content="Manage landing pages and variants." />
        <link rel="canonical" href="/app/pages" />
      </Helmet>

      <div className="grid gap-4 md:grid-cols-2">
        {pages.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{p.name}</span>
                <Badge variant={p.status === 'Active' ? 'default' : 'secondary'}>{p.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">Last edited {p.edited}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=>copy(snippet(p.id))}><Copy className="mr-2"/>Copy script</Button>
                <Button variant="secondary" onClick={()=>copy(`?adlign_variant=${p.id}`)}>Copy URL params</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Pages;
