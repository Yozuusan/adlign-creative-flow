import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const { login, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    setError(undefined);
    const fn = mode === "login" ? login : signup;
    const { error } = await fn(email, password);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen grid place-items-center">
      <Helmet>
        <title>Sign in — Adlign</title>
        <meta name="description" content="Log in to your Adlign account." />
        <link rel="canonical" href="/auth" />
      </Helmet>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Welcome back" : "Create account"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button className="w-full" onClick={submit}>{mode === "login" ? "Log in" : "Sign up"}</Button>
          <Button variant="ghost" className="w-full" onClick={()=>setMode(mode==="login"?"signup":"login")}>
            {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
