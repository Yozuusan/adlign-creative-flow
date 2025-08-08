import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart3, Sparkles, Plug, Layers } from "lucide-react";
import { useEffect, useState } from "react";

const Dashboard = () => {
  const [connected, setConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setConnected(localStorage.getItem("adlign_shop_connected") === "1");
      setShopDomain(localStorage.getItem("adlign_shop_domain") || "");
    }
  }, []);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Adlign Dashboard — Shopify Landing Variants</title>
        <meta name="description" content="Overview of your stores, pages, and performance." />
        <link rel="canonical" href="/app" />
      </Helmet>


      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quick start</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="hero">
              <Link to="/app/connect"><Plug className="mr-2" /> Connect Shopify</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/app/builder"><Sparkles className="mr-2" /> Generate variants</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/pages"><Layers className="mr-2" /> Manage pages</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/analytics"><BarChart3 className="mr-2" /> View analytics</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-[hsl(var(--success))]' : 'bg-destructive'}`}
                aria-hidden="true"
              />
              <div className="text-sm">
                <div className="font-medium">{connected ? 'Connecté' : 'Pas de boutique connectée'}</div>
                {connected && shopDomain && (
                  <div className="text-muted-foreground">{shopDomain}</div>
                )}
              </div>
            </div>
            {!connected && (
              <div className="mt-4">
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/connect"><Plug className="mr-2" /> Connecter maintenant</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
