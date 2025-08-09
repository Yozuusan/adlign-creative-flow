import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <main className="bg-chatgpt min-h-screen">
      <Helmet>
        <title>Adlign — AI‑Aligned Shopify Landing Variants</title>
        <meta name="description" content="Connect your Shopify store, generate aligned product‑page variants from your ad creatives, and deploy in one click." />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-2xl px-4 glass rounded-2xl border shadow-glow p-8 md:p-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-fade-in"><span className="bg-gradient-primary bg-clip-text text-transparent">Turn ad creatives into high‑converting product pages</span></h1>
          <p className="text-lg text-muted-foreground mb-6">Adlign analyzes your theme mapping and auto‑generates on‑brand variants for headlines, images, and CTAs. Preview, deploy, and track performance.</p>
          <a href="/auth"><Button variant="hero">Get started</Button></a>
        </div>
      </div>
    </main>
  );
};

export default Index;

