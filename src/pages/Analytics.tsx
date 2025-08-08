import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMemo } from "react";

const data = Array.from({ length: 14 }).map((_, i) => ({
  day: `Day ${i + 1}`,
  views: Math.round(500 + Math.random() * 500),
  clicks: Math.round(100 + Math.random() * 200),
  atc: Math.round(20 + Math.random() * 80),
}));

const Analytics = () => {
  const conversion = useMemo(() => {
    const v = data.reduce((a, b) => a + b.views, 0);
    const c = data.reduce((a, b) => a + b.atc, 0);
    return ((c / v) * 100).toFixed(2) + "%";
  }, []);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Analytics — Adlign</title>
        <meta name="description" content="Global and per-variant performance metrics." />
        <link rel="canonical" href="/app/analytics" />
      </Helmet>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Views</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.reduce((a,b)=>a+b.views,0)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Add‑to‑Cart</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.reduce((a,b)=>a+b.atc,0)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Conversion</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{conversion}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))"/>
              <YAxis stroke="hsl(var(--muted-foreground))"/>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#views)" />
              <Area type="monotone" dataKey="clicks" stroke="hsl(var(--accent))" fillOpacity={0} />
              <Area type="monotone" dataKey="atc" stroke="hsl(var(--ring))" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
