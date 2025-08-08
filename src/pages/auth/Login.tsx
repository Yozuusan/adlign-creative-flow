import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const { login, signup, loginWithGoogle, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate("/app");
  }, [session, navigate]);

  const submit = async () => {
    setError(undefined);
    const fn = mode === "login" ? login : signup;
    const { error } = await fn(email, password);
    if (error) setError(error);
  };

  const useTest = async () => {
    setEmail("admin@adlign.ai");
    setPassword("Sam.09girl");
  };

  const signInWithGoogle = async () => {
    setError(undefined);
    const { error } = await loginWithGoogle();
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-chatgpt p-4">
      <Helmet>
        <title>{mode === "login" ? "Sign in — Adlign" : "Create account — Adlign"}</title>
        <meta name="description" content="Log in or sign up to your Adlign account." />
        <link rel="canonical" href="/auth" />
      </Helmet>

      <Card className="w-full max-w-sm glass">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Welcome back" : "Create account"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button className="w-full" onClick={submit}>{mode === "login" ? "Log in" : "Sign up"}</Button>
          <Button variant="secondary" className="w-full" onClick={signInWithGoogle}>Continue with Google</Button>
          <Button variant="ghost" className="w-full" onClick={useTest}>Use test account</Button>
          <Button variant="ghost" className="w-full" onClick={()=>setMode(mode==="login"?"signup":"login")}>
            {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
