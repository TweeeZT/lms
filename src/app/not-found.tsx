"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Stack, Title, Text, Container, Paper } from "@mantine/core";

// Global 404 page used by Next.js when route not found
export default function NotFoundPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // Try localStorage first
    try {
      const ls = localStorage.getItem("userRole");
      if (ls) {
        setRole(ls);
        return;
      }
    } catch {}
    // Fallback to cookies (simple parse)
    if (typeof document !== "undefined") {
      const m = document.cookie.match(/(?:^|; )a_role=([^;]+)/);
      if (m) setRole(decodeURIComponent(m[1]));
    }
  }, []);

  const target =
    role === "admin"
      ? "/admin/dashboard"
      : role === "instructor"
      ? "/instructor/dashboard"
      : role === "user"
      ? "/user/dashboard"
      : "/";

  const buttonLabel = role ? "Kembali ke Dashboard" : "Kembali ke Beranda";

  return (
    <Container
      size="sm"
      fluid
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper p="xl" radius="md" style={{ width: "100%", textAlign: "center" }}>
        <Stack gap="md" align="center">
          <Title order={2}>Halaman Tidak Ditemukan</Title>
          <Text c="dimmed" size="sm">
            Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.
          </Text>
          <Image
            src="/404.png"
            alt="404 Not Found"
            width={400}
            height={300}
            style={{ objectFit: "contain", maxWidth: "100%" }}
            priority
          />
          <Button className="btn-primary" onClick={() => router.push(target)}>
            {buttonLabel}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
