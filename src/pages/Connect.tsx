import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Plug } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const Connect = () => {
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(false);
  const [backendUrl, setBackendUrl] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("adlign_backend_url") || "" : ""
  );
  

  const saveBackendUrl = () => {
    const url = backendUrl.trim();
    if (!url) {
      toast("Renseignez l’URL du backend (ex: https://api.votredomaine.com)");
      return;
    }
    try {
      // Valide l’URL
      const u = new URL(url);
      const cleaned = `${u.origin}`; // on garde l’origin propre
      localStorage.setItem("adlign_backend_url", cleaned);
      setBackendUrl(cleaned);
      toast("URL backend enregistrée.");
    } catch {
      toast("URL invalide. Exemple: https://api.votredomaine.com");
    }
  };

  const checkStatus = async (silent = true) => {
    const isConnected = typeof window !== "undefined" && localStorage.getItem("adlign_shop_connected") === "1";
    setConnected(isConnected);
    if (!silent) {
      toast(isConnected ? "Boutique connectée." : "Pas de boutique connectée.");
    }
    return isConnected;
  };

  const handleConnect = async () => {
    if (!shop) {
      toast("Entrez votre domaine (ex: myshop.myshopify.com)");
      return;
    }
    if (!backendUrl) {
      toast("Configurez d’abord l’URL du backend.");
      return;
    }
    const base = backendUrl.replace(/\/+$/, "");

    try {
      const res = await fetch(`${base}/api/saas/connect-shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shop_domain: shop })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.oauth_url) {
        throw new Error(data?.error || "Impossible de générer l’URL OAuth");
      }

      const w = window.open(data.oauth_url, "_blank", "noopener,noreferrer");
      if (w) w.opener = null; // Mitigation reverse‑tabnabbing

      setConnected(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("adlign_shop_connected", "1");
        localStorage.setItem("adlign_shop_domain", shop);
      }
      toast("Flux de connexion démarré dans un nouvel onglet.");
    } catch (err: any) {
      // Fallback direct à l’endpoint OAuth si l’API SaaS n’est pas disponible ou si CORS bloque
      try {
        const url = `${base}/auth?shop=${encodeURIComponent(shop)}`;
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (w) w.opener = null;
        setConnected(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("adlign_shop_connected", "1");
          localStorage.setItem("adlign_shop_domain", shop);
        }
        toast("Flux de connexion démarré (fallback) dans un nouvel onglet.");
      } catch {
        toast(err?.message || "Erreur lors de la connexion Shopify");
      }
    }
  };

  useEffect(() => {
    checkStatus(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adlign_shop_domain") || "";
      if (saved) setShop(saved);
    }
  }, [backendUrl]);


  return (
    <div className="space-y-6">
      <Helmet>
        <title>Connect Shopify — Adlign</title>
        <meta name="description" content="Connectez votre boutique Shopify à Adlign." />
        <link rel="canonical" href="/app/connect" />
      </Helmet>

      <div>
        <div className="text-sm text-muted-foreground mb-1">Statut</div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-[hsl(var(--success))]' : 'bg-destructive'}`}
            aria-hidden="true"
          />
          <span className="text-sm">{connected ? 'Connecté' : 'Pas de boutique connectée'}</span>
        </div>
      </div>

      <div className="max-w-xl space-y-3">
        <label className="text-sm">URL du backend</label>
        <div className="flex gap-2">
          <Input
            placeholder="https://api.votredomaine.com"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
          />
          <Button variant="secondary" onClick={saveBackendUrl}>Enregistrer</Button>
        </div>
        <p className="text-xs text-muted-foreground">Cette URL doit pointer vers votre API (ex: Express) qui expose /auth (OAuth Shopify).</p>
      </div>

      <div className="max-w-xl space-y-3">
        <label className="text-sm">Domaine Shopify</label>
        <Input
          placeholder="myshop.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
        />
        <Button onClick={handleConnect}><Plug className="mr-2" /> Connecter Shopify</Button>
      </div>
    </div>
  );
};

export default Connect;
