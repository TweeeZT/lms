"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Stack, Title, Text, Container, Paper } from "@mantine/core";

// Halaman Payment Failed
export default function PaymentFailedPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<string | null>(null);
  const courseId = params?.get("courseId");
  const invoiceId = params?.get("invoiceId");

  useEffect(() => {
    // Ambil role dari localStorage
    try {
      const ls = localStorage.getItem("userRole");
      if (ls) {
        setRole(ls);
        return;
      }
    } catch {}
    // Fallback cek cookie
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

  const buttonLabel = role ? "Coba Lagi" : "Kembali ke Beranda";

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
          <Title order={2} c="red">
            Pembayaran Gagal
          </Title>
          <Text c="dimmed" size="sm">
            Maaf, pembayaran Anda tidak berhasil diproses.
            {courseId && (
              <>
                {" "}
                Kursus: <b>{courseId}</b>.
              </>
            )}
            {invoiceId && (
              <>
                {" "}
                Invoice: <b>{invoiceId}</b>.
              </>
            )}
          </Text>
          <Image
            src="/failed.png"
            alt="Payment Failed"
            width={400}
            height={300}
            style={{ objectFit: "contain", maxWidth: "100%" }}
            priority
          />
          <Button
            className="btn-primary"
            onClick={() => router.push(target)}
            radius="xl"
            color="red"
          >
            {buttonLabel}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
