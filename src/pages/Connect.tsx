import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const Connect = () => {
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(false);

  const handleConnect = () => {
    if (!shop) {
      toast("Enter your shop domain (e.g. myshop.myshopify.com)");
      return;
    }
    // In production: redirect to your backend's Shopify OAuth start endpoint
    const url = `/api/shopify/connect?shop=${encodeURIComponent(shop)}`;
    window.open(url, "_blank");
    setConnected(true);
    toast("Connection flow started in a new tab.");
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Connect Shopify — Adlign</title>
        <meta name="description" content="Connect your Shopify store to Adlign." />
        <link rel="canonical" href="/app/connect" />
      </Helmet>
      <div>
        <div className="text-sm text-muted-foreground mb-1">Status</div>
        {connected ? (
          <Badge>Connected</Badge>
        ) : (
          <Badge variant="secondary">Not connected</Badge>
        )}
      </div>

      <div className="max-w-xl space-y-3">
        <label className="text-sm">Shopify store domain</label>
        <Input
          placeholder="myshop.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
        />
        <Button onClick={handleConnect}><Plug className="mr-2" /> Connect Shopify</Button>
      </div>
    </div>
  );
};

export default Connect;
