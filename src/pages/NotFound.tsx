import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Helmet>
        <title>Page not found — Adlign</title>
        <meta name="description" content="The page you are looking for does not exist." />
        <link rel="canonical" href="/404" />
      </Helmet>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/"><Button variant="outline">Return to Home</Button></a>
      </div>
    </div>
  );
};

export default NotFound;
