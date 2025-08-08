import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session as SupaSession, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: SupaSession | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string) => Promise<{ error?: string }>;
  loginWithGoogle: () => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<SupaSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const friendly = (msg?: string) => {
    if (!msg) return undefined;
    if (/Invalid login credentials/i.test(msg)) return "Invalid email or password";
    if (/Email rate limit/i.test(msg)) return "Too many attempts. Try again later.";
    if (/User already registered/i.test(msg)) return "This email is already registered";
    return msg;
  };

  const login = async (email: string, password: string) => {
    if (!email || !password) return { error: "Email and password required" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: friendly(error?.message) };
  };

  const signup = async (email: string, password: string) => {
    if (!email || !password) return { error: "Email and password required" };
    const redirectUrl = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    return { error: friendly(error?.message) };
  };

  const loginWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    return { error: friendly(error?.message) };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
