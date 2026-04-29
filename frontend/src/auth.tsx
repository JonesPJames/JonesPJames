import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setToken, TOKEN_KEY } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  company: string;
  phone: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, company: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem(TOKEN_KEY);
      if (t) {
        try {
          const r = await api.get("/auth/me");
          setUser(r.data);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    await setToken(r.data.token);
    setUser(r.data.user);
  }

  async function register(email: string, password: string, name: string, company: string, phone: string) {
    const r = await api.post("/auth/register", { email, password, name, company, phone });
    await setToken(r.data.token);
    setUser(r.data.user);
  }

  async function logout() {
    await setToken(null);
    setUser(null);
  }

  async function refresh() {
    const r = await api.get("/auth/me");
    setUser(r.data);
  }

  async function updateProfile(data: Partial<User>) {
    const r = await api.put("/auth/me", data);
    setUser(r.data);
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
