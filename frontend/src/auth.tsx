import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setToken, TOKEN_KEY } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  company_code: string;
  ico?: string;
  dic?: string;
  bank_account?: string; // Rozšíření typu uživatele o číslo účtu / IBAN
};

export type Employee = {
  id: string;        // "ZAM-001"
  name: string;
  phone: string;
  pin: string;
  active: boolean;
  owner_user_id: string;
  trade?: string;
  company_code?: string;
};

export type Actor =
  | { role: "owner"; user: User }
  | { role: "employee"; employee: Employee };

const ROLE_KEY = "rp_role";

type AuthCtx = {
  actor: Actor | null;
  loading: boolean;
  /** Convenience getter — owner User or null. Most existing screens expect this. */
  user: User | null;
  /** Convenience getter — employee or null. */
  employee: Employee | null;
  loginOwner: (email: string, password: string) => Promise<void>;
  /** Alias for loginOwner — used by older login.tsx. */
  login: (email: string, password: string) => Promise<void>;
  loginEmployee: (companyCode: string, pin: string) => Promise<void>;
  register: (email: string, password: string, name: string, company: string, phone: string, ico?: string, dic?: string, bank_account?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem(TOKEN_KEY);
      const r = await AsyncStorage.getItem(ROLE_KEY);
      if (t) {
        try {
          if (r === "employee") {
            const res = await api.get("/auth/me-employee");
            setActor({ role: "employee", employee: res.data });
          } else {
            const res = await api.get("/auth/me");
            setActor({ role: "owner", user: res.data });
          }
        } catch {
          await setToken(null);
          await AsyncStorage.removeItem(ROLE_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function loginOwner(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    await setToken(r.data.token);
    await AsyncStorage.setItem(ROLE_KEY, "owner");
    setActor({ role: "owner", user: r.data.user });
  }

  async function loginEmployee(companyCode: string, pin: string) {
    const r = await api.post("/auth/login-pin", { company_code: companyCode, pin });
    await setToken(r.data.token);
    await AsyncStorage.setItem(ROLE_KEY, "employee");
    setActor({ role: "employee", employee: r.data.employee });
  }

  async function register(
    email: string, 
    password: string, 
    name: string, 
    company: string, 
    phone: string, 
    ico: string = "", 
    dic: string = "", 
    bank_account: string = "" // Přidáno do parametrů registrace
  ) {
    const r = await api.post("/auth/register", { email, password, name, company, phone, ico, dic, bank_account });
    await setToken(r.data.token);
    await AsyncStorage.setItem(ROLE_KEY, "owner");
    setActor({ role: "owner", user: r.data.user });
  }

  async function logout() {
    await setToken(null);
    await AsyncStorage.removeItem(ROLE_KEY);
    setActor(null);
  }

  async function refresh() {
    if (!actor) return;
    if (actor.role === "owner") {
      const r = await api.get("/auth/me");
      setActor({ role: "owner", user: r.data });
    } else {
      const r = await api.get("/auth/me-employee");
      setActor({ role: "employee", employee: r.data });
    }
  }

  async function updateProfile(data: Partial<User>) {
    const r = await api.put("/auth/me", data);
    setActor({ role: "owner", user: r.data });
  }

  const user = actor?.role === "owner" ? actor.user : null;
  const employee = actor?.role === "employee" ? actor.employee : null;

  return (
    <Ctx.Provider
      value={{
        actor,
        loading,
        user,
        employee,
        loginOwner,
        login: loginOwner,
        loginEmployee,
        register,
        logout,
        refresh,
        updateProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Compatibility helper — many existing screens still use `user` directly. */
export function useOwner() {
  const { actor, loading, loginOwner, register, logout, refresh, updateProfile } = useAuth();
  const user = actor?.role === "owner" ? actor.user : null;
  return { user, loading, login: loginOwner, register, logout, refresh, updateProfile };
}