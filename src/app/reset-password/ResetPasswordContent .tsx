"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
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
  const [info, setInfo] = useState<string | null>(null);
  const [tokenState, setTokenState] = useState<
    "checking" | "valid" | "invalid"
  >("checking");

  const recoveryOK = useMemo(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("recovery_ok") === "1";
  }, [params]);

  // On mount: If recovery hash present in URL (supabase appends to hash), finalize session
  useEffect(() => {
    // Supabase sends recovery links to our redirectTo. The URL fragment contains access_token, type=recovery, etc.
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const finishWithRedirect = (notice: string) => {
      setTokenState("invalid");
      router.replace(`/login?notice=${encodeURIComponent(notice)}`);
    };

    // If already validated in this tab (page refresh), allow
    if (!hash && sessionStorage.getItem("recovery_ok") === "1") {
      setTokenState("valid");
      return;
    }

    if (!hash) {
      finishWithRedirect("reset-required");
      return;
    }

    const qs = new URLSearchParams(hash.replace(/^#/, ""));

    // Handle error fragments from Supabase (expired/invalid)
    const err = qs.get("error");
    const errCode = qs.get("error_code");
    if (err || errCode) {
      const notice =
        errCode === "otp_expired" ? "reset-expired" : "reset-invalid";
      // Clean hash then redirect
      window.history.replaceState({}, document.title, window.location.pathname);
      finishWithRedirect(notice);
      return;
    }

    const type = qs.get("type");
    const access_token = qs.get("access_token");
    const refresh_token = qs.get("refresh_token");

    if (type !== "recovery" || !access_token || !refresh_token) {
      window.history.replaceState({}, document.title, window.location.pathname);
      finishWithRedirect("reset-invalid");
      return;
    }

    // Let supabase-js process the URL hash and set the session, then clear the hash
    (async () => {
      try {
        const { error: setErr } = (await supabase.auth.setSession({
          access_token,
          refresh_token,
        } as any)) as unknown as { error?: unknown };
        if (setErr) throw setErr as any;
        // Clean up hash to avoid leaking tokens in address bar
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        sessionStorage.setItem("recovery_ok", "1");
        setTokenState("valid");
      } catch {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        finishWithRedirect("reset-invalid");
      }
    })();
  }, [params]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!password || password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;
      // Clear gate and redirect to login with success notice
      try {
        sessionStorage.removeItem("recovery_ok");
      } catch {}
      router.replace("/login?notice=reset-success");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };

  // Gate: Only render form when token is validated
  if (tokenState !== "valid" && !recoveryOK) {
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
            {info && (
              <Alert color="green" mb="md" variant="light">
                {info}
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
