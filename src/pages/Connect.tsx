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

  const handleConnect = () => {
    if (!shop) {
      toast("Entrez votre domaine (ex: myshop.myshopify.com)");
      return;
    }
    if (!backendUrl) {
      toast("Configurez d’abord l’URL du backend.");
      return;
    }
    const base = backendUrl.replace(/\/+$/, "");
    const url = `${base}/auth?shop=${encodeURIComponent(shop)}`;

    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (w) w.opener = null; // Mitigation reverse‑tabnabbing

    setConnected(true);
    toast("Flux de connexion démarré dans un nouvel onglet.");
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Connect Shopify — Adlign</title>
        <meta name="description" content="Connectez votre boutique Shopify à Adlign." />
        <link rel="canonical" href="/app/connect" />
      </Helmet>

      <div>
        <div className="text-sm text-muted-foreground mb-1">Statut</div>
        {connected ? (
          <Badge>Connecté</Badge>
        ) : (
          <Badge variant="secondary">Non connecté</Badge>
        )}
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
