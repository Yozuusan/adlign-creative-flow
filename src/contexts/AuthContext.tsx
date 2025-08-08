import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface Session {
  user: { email: string };
  token: string;
}

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "adlign:session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {}
    }
    setLoading(false);
  }, []);

  const persist = (sess: Session | null) => {
    if (sess) localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
    else localStorage.removeItem(STORAGE_KEY);
    setSession(sess);
  };

  const login = async (email: string, password: string) => {
    if (!email || !password) return { error: "Email and password required" };
    persist({ user: { email }, token: "demo-token" });
    return {};
  };

  const signup = async (email: string, password: string) => {
    if (!email || !password) return { error: "Email and password required" };
    persist({ user: { email }, token: "demo-token" });
    return {};
  };

  const logout = async () => {
    persist(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
