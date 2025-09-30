"use client";

import { useState } from "react";
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
  const signInWithProvider = async (provider: "google" | "github") => {
    try {
      setLoginError(null);
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

      // After redirect back, session should be present; guard via server
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      if (!userId) return; // waiting for redirect

      const res = await fetch(`/api/auth/guard?userId=${userId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        await supabase.auth.signOut();
        setLoginError(
          "Akun tidak ditemukan. Silakan gunakan akun yang sudah terdaftar."
        );
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

      if (mapped.role === "admin") router.push("/admin/dashboard");
      else if (mapped.role === "instructor")
        router.push("/instructor/dashboard");
      else if (mapped.role === "user") router.push("/user/dashboard");
      else router.push("/");
    } catch (e: unknown) {
      setLoginError(
        e instanceof Error ? e.message : "Gagal login dengan provider"
      );
    }
  };

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
              onClick={() => signInWithProvider("google")}
            >
              Google
            </Button>
            <Button
              type="button"
              variant="default"
              leftSection={<IconBrandGithub size={16} />}
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
