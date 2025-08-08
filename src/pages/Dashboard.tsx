import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart3, Sparkles, Plug, Layers } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <Helmet>
        <title>Adlign Dashboard — Shopify Landing Variants</title>
        <meta name="description" content="Overview of your stores, pages, and performance." />
        <link rel="canonical" href="/app" />
      </Helmet>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Views", value: "12,340" },
          { label: "Clicks", value: "3,129" },
          { label: "Add‑to‑Cart", value: "1,024" },
          { label: "Conversion", value: "3.2%" },
        ].map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            <ul className="space-y-2 text-sm">
              <li>Shopify connection: Not connected</li>
              <li>Pages created: 0</li>
              <li>Active experiments: 0</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
