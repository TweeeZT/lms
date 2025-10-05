"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Anchor,
  Stack,
  Alert,
  Checkbox,
  Group,
  Divider,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconMail,
  IconLock,
  IconBrandGoogle,
  IconBrandGithub,
} from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";
import { LoginCredentials } from "../../types";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const schema = z.object({
  email: z
    .string()
    .min(1, { message: "Email harus diisi" })
    .email({ message: "Email tidak valid" }),
  password: z.string().min(1, { message: "Password harus diisi" }),
  rememberMe: z.boolean().optional(),
});

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full relative flex items-center justify-center">
      {/* Soft Blue Radial Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "#ffffff",
          backgroundImage: `radial-gradient(circle at top center, rgba(59, 130, 246, 0.5),transparent 70%)`,
        }}
      />

      {/* Right login form */}
      <div className="flex-1 max-w-md w-full mx-auto">
        <LoginForm />
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState<
    "google" | "github" | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials & { rememberMe?: boolean }>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", rememberMe: false },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setLoginError(null);
      const result = await login(data);
      if (result.success) {
        // Persist lightweight auth cookies for auto-login fallback
        try {
          const cached = localStorage.getItem("afterschola_user");
          if (cached) {
            const parsed = JSON.parse(cached) as {
              id: string;
              role: string;
              fullName?: string;
            };
            // 'data' may include rememberMe per form generic; treat truthy as 30-day
            const ttlDays = (data as { rememberMe?: boolean }).rememberMe
              ? 30
              : 1; // fallback if rememberMe included
            const maxAge = ttlDays * 24 * 60 * 60; // seconds
            const safeName = encodeURIComponent(parsed.fullName || "User");
            document.cookie = `a_uid=${encodeURIComponent(
              parsed.id
            )}; Path=/; Max-Age=${maxAge}`;
            document.cookie = `a_role=${encodeURIComponent(
              parsed.role
            )}; Path=/; Max-Age=${maxAge}`;
            document.cookie = `a_uname=${safeName}; Path=/; Max-Age=${maxAge}`;
          }
        } catch {}
        const userRole = localStorage.getItem("userRole");
        if (userRole === "admin") {
          router.push("/admin/dashboard");
        } else if (userRole === "instructor") {
          router.push("/instructor/dashboard");
        } else if (userRole === "user") {
          router.push("/user/dashboard");
        } else {
          router.push("/");
        }
      } else {
        setLoginError(result.error || "Login gagal");
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Login gagal");
    }
  };

  // OAuth login-only: If user exists, proceed; if new, block and sign out
  // Tentukan path redirect berdasarkan role
  const getRedirectPath = (role?: string | null) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "instructor") return "/instructor/dashboard";
    if (role === "user") return "/user/dashboard";
    return "/";
  };

  const signInWithProvider = async (provider: "google" | "github") => {
    try {
      setLoginError(null);
      setProviderLoading(provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
      // Poll ringan untuk menunggu session (kadang delay setelah redirect)
      let userId: string | undefined;
      for (let i = 0; i < 10; i++) {
        // up to ~2s total
        const session = await supabase.auth.getSession();
        userId = session.data.session?.user?.id;
        if (userId) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!userId) {
        setLoginError("Gagal mendapatkan sesi OAuth. Coba lagi.");
        return;
      }

      // Panggil guard untuk memastikan profil ada
      const res = await fetch(`/api/auth/guard?userId=${userId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        // Jika not_found -> user belum terdaftar (kebijakan login-only)
        if (json?.error === "not_found") {
          setLoginError(
            "Akun OAuth belum terdaftar di sistem. Silakan daftar manual dengan email."
          );
        } else {
          setLoginError(json?.error || "Login OAuth gagal");
        }
        await supabase.auth.signOut();
        return;
      }

      // Persist profile locally similar to email login
      const mapped = json.user;
      localStorage.setItem(
        "afterschola_user",
        JSON.stringify({
          id: mapped.id,
          email: mapped.email,
          username: mapped.username,
          fullName: mapped.fullName,
          role: mapped.role,
          avatar: mapped.avatar,
          phone: mapped.phone,
          bio: mapped.bio,
          level: 1,
          points: 0,
          balance: 0,
          createdAt: mapped.createdAt,
          updatedAt: mapped.updatedAt,
        })
      );
      localStorage.setItem("userRole", mapped.role);

      // Set cookies for fallback auto-login (non-HttpOnly client side). In production consider setting via secure HTTP-only cookie from server.
      try {
        const ttlDays = 7; // OAuth treat as 1 week
        const maxAge = ttlDays * 24 * 60 * 60;
        document.cookie = `a_uid=${encodeURIComponent(
          mapped.id
        )}; Path=/; Max-Age=${maxAge}`;
        document.cookie = `a_role=${encodeURIComponent(
          mapped.role
        )}; Path=/; Max-Age=${maxAge}`;
        document.cookie = `a_uname=${encodeURIComponent(
          mapped.fullName || "User"
        )}; Path=/; Max-Age=${maxAge}`;
      } catch {}

      router.push(getRedirectPath(mapped.role));
    } catch (e: unknown) {
      setLoginError(
        e instanceof Error ? e.message : "Gagal login dengan provider"
      );
    } finally {
      setProviderLoading(null);
    }
  };

  // Auto finalize jika user kembali dari redirect OAuth dan sudah punya session tapi belum terset local storage
  useEffect(() => {
    let cancelled = false;
    const finalize = async () => {
      try {
        // Hindari override kalau sudah ada userRole di localStorage
        if (typeof window === "undefined") return;
        const existingRole = localStorage.getItem("userRole");
        if (existingRole) return; // sudah selesai sebelumnya
        const session = await supabase.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) return;
        const res = await fetch(`/api/auth/guard?userId=${userId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          if (json?.error === "not_found") {
            await supabase.auth.signOut();
            if (!cancelled)
              setLoginError(
                "Akun OAuth belum terdaftar. Silakan daftar manual."
              );
          }
          return;
        }
        if (cancelled) return;
        const mapped = json.user;
        localStorage.setItem(
          "afterschola_user",
          JSON.stringify({
            id: mapped.id,
            email: mapped.email,
            username: mapped.username,
            fullName: mapped.fullName,
            role: mapped.role,
            avatar: mapped.avatar,
            phone: mapped.phone,
            bio: mapped.bio,
            level: 1,
            points: 0,
            balance: 0,
            createdAt: mapped.createdAt,
            updatedAt: mapped.updatedAt,
          })
        );
        localStorage.setItem("userRole", mapped.role || "user");
        // Redirect sesuai role
        router.push(getRedirectPath(mapped.role));
      } catch {}
    };
    finalize();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Paper
      withBorder
      shadow="xl"
      p={32}
      radius="lg"
      className="bg-white backdrop-blur-md"
    >
      <Title ta="center" order={2} className="mb-2 font-bold text-gray-800">
        Selamat Datang
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb={20}>
        Belum punya akun?{" "}
        <Anchor size="sm" onClick={() => router.push("/signup")}>
          Daftar di sini
        </Anchor>
      </Text>

      {loginError && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          color="red"
          mb="md"
          variant="light"
        >
          {loginError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="sm">
          <Group grow gap="sm">
            <Button
              type="button"
              variant="default"
              leftSection={<IconBrandGoogle size={16} />}
              loading={providerLoading === "google"}
              onClick={() => signInWithProvider("google")}
            >
              Google
            </Button>
            <Button
              type="button"
              variant="default"
              leftSection={<IconBrandGithub size={16} />}
              loading={providerLoading === "github"}
              onClick={() => signInWithProvider("github")}
            >
              GitHub
            </Button>
          </Group>
          <Divider label="atau login dengan email" my="xs" />
          <TextInput
            label="Email"
            placeholder="email@example.com"
            leftSection={<IconMail size="1rem" />}
            {...register("email")}
            error={errors.email?.message}
          />

          <PasswordInput
            label="Password"
            placeholder="Password Anda"
            leftSection={<IconLock size="1rem" />}
            {...register("password")}
            error={errors.password?.message}
          />

          <Checkbox label="Ingat saya" {...register("rememberMe")} />

          <Button
            type="submit"
            fullWidth
            mt="sm"
            loading={loading}
            className="bg-blue-500 hover:bg-blue-600 transition-all duration-200"
            size="md"
          >
            Masuk
          </Button>

          <Text ta="center" mt="md" size="sm">
            <Anchor size="sm" component={Link} href="/forgot-password">
              Lupa password?
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
