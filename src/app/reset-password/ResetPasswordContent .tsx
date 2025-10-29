"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Paper,
  PasswordInput,
  Button,
  Title,
  Text,
  Alert,
  Container,
} from "@mantine/core";
import { IconAlertCircle, IconLock } from "@tabler/icons-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = params?.get("token");
    if (!t) {
      router.replace("/login?notice=reset-required");
      return;
    }
    setToken(t);
    setTokenValid(true);
  }, [params, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    if (!token) {
      setError("Token tidak valid");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Gagal mengubah password");
        return;
      }
      router.replace("/login?notice=reset-success");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };

  if (!tokenValid) {
    return null;
  }

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
        <Container className="z-10">
          <Paper
            withBorder
            shadow="xl"
            p={32}
            radius="lg"
            className="bg-white backdrop-blur-md"
          >
            <Title order={2} mb="xs">
              Reset Password
            </Title>
            <Text c="dimmed" size="sm" mb="md">
              Masukkan password baru Anda.
            </Text>
            {error && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                color="red"
                mb="md"
                variant="light"
              >
                {error}
              </Alert>
            )}
            <form onSubmit={onSubmit}>
              <PasswordInput
                label="Password Baru"
                placeholder="Minimal 6 karakter"
                leftSection={<IconLock size="1rem" />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <PasswordInput
                mt="md"
                label="Konfirmasi Password"
                placeholder="Ulangi password baru"
                leftSection={<IconLock size="1rem" />}
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
                required
              />
              <Button
                type="submit"
                fullWidth
                mt="md"
                loading={loading}
                className="btn-primary"
              >
                Simpan Password
              </Button>
            </form>
            <Button
              variant="subtle"
              fullWidth
              mt="sm"
              onClick={() => router.push("/login")}
            >
              Kembali ke Login
            </Button>
          </Paper>
        </Container>
      </div>
    </div>
  );
}
