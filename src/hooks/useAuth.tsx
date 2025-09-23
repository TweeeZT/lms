"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { User, LoginCredentials, SignupData } from "../types";
import { supabase } from "../lib/supabaseClient";

interface AuthContextType {
  user: User | null;
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  type ProfileRow = {
    id: string;
    email: string;
    username: string;
    full_name: string;
    avatar?: string | null;
    phone?: string | null;
    bio?: string | null;
    role?: User["role"] | null;
    level?: number | null;
    points?: number | null;
    balance?: number | null;
    created_at: string;
    updated_at: string;
  };

  useEffect(() => {
    // Load active session from Supabase and fetch profile with role
    const init = async () => {
      try {
        // Fast-path from cookies/localStorage to reduce flicker
        const cached =
          typeof window !== "undefined"
            ? localStorage.getItem("afterschola_user")
            : null;
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as User;
            setUser(parsed);
          } catch {}
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          // Try look up by email first (works even if users.id != auth.users.id)
          const email = session.user.email as string | null;
          let profile: ProfileRow | null = null;
          if (email) {
            const byEmail = await supabase
              .from("users")
              .select(
                "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
              )
              .eq("email", email)
              .maybeSingle();
            if (!byEmail.error) profile = byEmail.data;
          }
          if (!profile) {
            const byId = await supabase
              .from("users")
              .select(
                "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
              )
              .eq("id", session.user.id)
              .maybeSingle();
            if (!byId.error) profile = byId.data;
          }

          if (profile) {
            // Determine role column or infer from role tables
            let role: User["role"] | null = profile.role ?? null;
            if (!role) {
              const pid = profile.id as string;
              const [a, i, s] = await Promise.all([
                supabase
                  .from("admins")
                  .select("user_id")
                  .eq("user_id", pid)
                  .maybeSingle(),
                supabase
                  .from("instructors")
                  .select("user_id")
                  .eq("user_id", pid)
                  .maybeSingle(),
                supabase
                  .from("students")
                  .select("user_id")
                  .eq("user_id", pid)
                  .maybeSingle(),
              ]);
              if (!a.error && a.data) role = "admin";
              else if (!i.error && i.data) role = "instructor";
              else if (!s.error && s.data) role = "user";
              else role = "user";
            }

            const mapped: User = {
              id: profile.id,
              email: profile.email,
              username: profile.username,
              fullName: profile.full_name,
              role,
              avatar: profile.avatar ?? undefined,
              phone: profile.phone ?? undefined,
              bio: profile.bio ?? undefined,
              level: 1,
              points: 0,
              balance: 0,
              createdAt: profile.created_at
                ? new Date(profile.created_at)
                : new Date(),
              updatedAt: profile.updated_at
                ? new Date(profile.updated_at)
                : new Date(),
            };
            setUser(mapped);
            localStorage.setItem("afterschola_user", JSON.stringify(mapped));
            localStorage.setItem("userRole", mapped.role);
          }
        } else {
          // If no Supabase session, try cookies for role/id to keep UX logged in
          if (typeof document !== "undefined") {
            const m = document.cookie.match(/(?:^|; )a_uid=([^;]+)/);
            const rid = document.cookie.match(/(?:^|; )a_role=([^;]+)/);
            const uname = document.cookie.match(/(?:^|; )a_uname=([^;]+)/);
            if (m && rid) {
              const id = decodeURIComponent(m[1]);
              const role = decodeURIComponent(rid[1]) as User["role"];
              const fullName = uname ? decodeURIComponent(uname[1]) : "User";
              const fallback: User = {
                id,
                email: "",
                username: "",
                fullName,
                role,
                level: 1,
                points: 0,
                balance: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              setUser(fallback);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      // 1) Sign in on client so session persists in the browser
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (authErr) {
        const msg = /invalid login credentials/i.test(authErr.message)
          ? "Email atau password salah"
          : authErr.message;
        return { success: false, error: msg };
      }

      // 2) Resolve profile + role via API to keep server logic centralized
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Login gagal" };
      }

      const mapped: User = {
        id: json.user.id,
        email: json.user.email,
        username: json.user.username,
        fullName: json.user.fullName,
        role: json.user.role,
        avatar: json.user.avatar,
        phone: json.user.phone,
        bio: json.user.bio,
        level: 1,
        points: 0,
        balance: 0,
        createdAt: new Date(json.user.createdAt),
        updatedAt: new Date(json.user.updatedAt),
      };
      localStorage.setItem("afterschola_user", JSON.stringify(mapped));
      localStorage.setItem("userRole", mapped.role);
      setUser(mapped);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login gagal";
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    data: SignupData
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          username: data.username,
          fullName: data.fullName,
          role: data.role,
          phone: data.phone,
          bio: data.bio,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Signup gagal" };
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup gagal";
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    supabase.auth.signOut();
    // Clear server cookies
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("afterschola_user");
    localStorage.removeItem("userRole");
    setUser(null);
  };

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      const next = { ...(prev as User), ...partial } as User;
      try {
        localStorage.setItem("afterschola_user", JSON.stringify(next));
        if (partial.role) localStorage.setItem("userRole", next.role);
      } catch {}
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, login, signup, logout, loading, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Demo login credentials for testing
export const demoCredentials = undefined as unknown as never;
