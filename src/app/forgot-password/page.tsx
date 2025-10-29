"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  TextInput,
  Button,
  Title,
  Text,
  Alert,
  Container,
} from "@mantine/core";
import { IconAlertCircle, IconMail } from "@tabler/icons-react";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);
    try {
      // Use custom forgot-password API with branded email
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Gagal mengirim email reset");
        return;
      }
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengirim email reset");
    } finally {
      setLoading(false);
    }
  };

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

      <Container size={500} className="relative z-10">
        <Paper
          withBorder
          shadow="xl"
          p={32}
          radius="lg"
          className="bg-white backdrop-blur-md"
        >
          <Title order={2} mb="xs">
            Lupa Password
          </Title>
          <Text c="dimmed" size="sm" mb="md">
            Masukkan email Anda. Jika terdaftar, kami akan mengirim link reset.
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
          {sent && (
            <Alert color="green" mb="md" variant="light">
              Link reset password telah dikirim. Silakan cek email Anda.
            </Alert>
          )}
          <form onSubmit={onSubmit}>
            <TextInput
              label="Email"
              placeholder="email@example.com"
              leftSection={<IconMail size="1rem" />}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <Button
              type="submit"
              fullWidth
              mt="md"
              loading={loading}
              className="btn-primary"
            >
              Kirim Link Reset
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
  );
}
