"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Stack,
  Title,
  Text,
  Container,
  Paper,
  Loader,
  Alert,
} from "@mantine/core";

// Halaman Payment Success
export default function PaymentSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<string | null>(null);
  const courseIdParam = params?.get("courseId") || undefined;
  const invoiceIdParam = params?.get("invoiceId") || undefined;
  const [courseId, setCourseId] = useState<string | undefined>(courseIdParam);
  const [invoiceId, setInvoiceId] = useState<string | undefined>(
    invoiceIdParam
  );
  const [status, setStatus] = useState<string>("checking");
  const [pollError, setPollError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Load role & pending IDs from localStorage if missing in URL
    try {
      const ls = localStorage.getItem("userRole");
      if (ls) setRole(ls);
      if (!invoiceIdParam) {
        const inv = localStorage.getItem("pending_invoiceId") || undefined;
        if (inv) setInvoiceId(inv);
      }
      if (!courseIdParam) {
        const cid = localStorage.getItem("pending_courseId") || undefined;
        if (cid) setCourseId(cid);
      }
    } catch {}
    // cookie fallback for role
    if (!role && typeof document !== "undefined") {
      const m = document.cookie.match(/(?:^|; )a_role=([^;]+)/);
      if (m) setRole(decodeURIComponent(m[1]));
    }
  }, [invoiceIdParam, courseIdParam, role]);

  const pollStatus = useCallback(async () => {
    if (!invoiceId) return;
    try {
      setPollError(null);
      const userRaw = localStorage.getItem("afterschola_user");
      let userId: string | undefined;
      if (userRaw) {
        try {
          const parsed = JSON.parse(userRaw);
          userId = parsed.id;
        } catch {}
      }
      const url = `/api/user/checkout/confirm?invoiceId=${encodeURIComponent(
        invoiceId
      )}${
        courseId ? `&courseId=${encodeURIComponent(courseId)}` : ""
      }$${""}`.replace(/\$\$/g, "");
      const withUser = userId
        ? `${url}&userId=${encodeURIComponent(userId)}`
        : url;
      const res = await fetch(withUser, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setStatus(json.status);
        if (json.status === "completed" || json.status === "cancelled") {
          // cleanup
          try {
            localStorage.removeItem("pending_invoiceId");
            localStorage.removeItem("pending_courseId");
          } catch {}
        }
      } else {
        setPollError(json.error || "Gagal cek status");
      }
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Network error");
    } finally {
      setAttempts((a) => a + 1);
    }
  }, [invoiceId, courseId]);

  // Poll every 4s up to 20 attempts (~80s)
  useEffect(() => {
    if (!invoiceId) return;
    if (status === "completed" || status === "cancelled") return;
    if (attempts === 0) pollStatus();
    const id = setInterval(() => {
      setAttempts((a) => {
        if (a >= 20) return a; // stop
        pollStatus();
        return a + 1;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [invoiceId, status, attempts, pollStatus]);

  const target =
    role === "admin"
      ? "/admin/dashboard"
      : role === "instructor"
      ? "/instructor/dashboard"
      : role === "user"
      ? "/user/courses"
      : "/";

  const buttonLabel = role ? "Kembali ke Dashboard" : "Kembali ke Beranda";

  const finished = status === "completed";
  const cancelled = status === "cancelled";

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
          {finished && (
            <Title order={2} c="green">
              Pembayaran Berhasil
            </Title>
          )}
          {cancelled && (
            <Title order={2} c="red">
              Pembayaran Dibatalkan / Kadaluarsa
            </Title>
          )}
          {!finished && !cancelled && (
            <Title order={3}>Memverifikasi Pembayaran…</Title>
          )}
          <Text c="dimmed" size="sm" ta="center">
            {finished &&
              "Terima kasih! Pembayaran Anda berhasil dan enrollment akan segera aktif."}
            {cancelled &&
              "Transaksi dibatalkan atau kadaluarsa. Silakan ulangi proses checkout."}
            {!finished &&
              !cancelled &&
              "Mohon tunggu, kami sedang memastikan status transaksi dari server."}
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
          {!finished && !cancelled && <Loader color="blue" />}
          {pollError && (
            <Alert color="red" variant="light" title="Cek Status" w="100%">
              {pollError}
            </Alert>
          )}
          <Image
            src={cancelled ? "/failed.png" : "/success.png"}
            alt={cancelled ? "Payment Failed" : "Payment Success"}
            width={400}
            height={300}
            style={{ objectFit: "contain", maxWidth: "100%" }}
            priority
          />
          {(finished || cancelled) && (
            <Button
              className="btn-primary"
              onClick={() => router.push(target)}
              radius="xl"
            >
              {buttonLabel}
            </Button>
          )}
          {!finished && !cancelled && attempts > 20 && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Muat Ulang
            </Button>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
