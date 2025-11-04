"use client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import {
  Box,
  Title,
  Paper,
  Grid,
  Text,
  Card,
  Button,
  Divider,
  Group,
  Stack,
} from "@mantine/core";
import {
  IconUsers,
  IconBook,
  IconCertificate,
  IconTrendingUp,
} from "@tabler/icons-react";

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const bg = "var(--primary-color)";
  const iconBadgeBg = "var(--secondary-color)";
  const textColor = "#ffffff";
  return (
    <Paper
      withBorder
      p="xl"
      radius="lg"
      style={{
        background: bg,
        color: textColor,
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: "default",
      }}
      className="hover:scale-105 hover:shadow-xl"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            background: iconBadgeBg,
            borderRadius: 12,
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={32} color="#1e3769" />
        </div>
        <div style={{ flex: 1 }}>
          <Text size="sm" style={{ opacity: 0.9, marginBottom: 4 }}>
            {label}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </div>
      </div>
    </Paper>
  );
}

export default function SchoolDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalStudents: number;
    activeCourses: number;
    totalEnrollments: number;
    completionRate: number;
  } | null>(null);
  const [transactions, setTransactions] = useState<Array<{
    id: string;
    date: string;
    course_title: string;
    amount: number;
    status: string;
  }> | null>(null);
  const [students, setStudents] = useState<Array<{
    id: string;
    name: string;
    email: string;
    status?: string;
  }> | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/school/dashboard?schoolUserId=${user.id}`
        );
        const json = await res.json();
        if (res.ok && json.success) {
          setStats(json.stats);
          // set transactions if provided by the API
          if (Array.isArray(json.transactions))
            setTransactions(json.transactions);
        } else {
          setError(json.error || "Gagal memuat data");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();

    // fetch students separately
    const fetchStudents = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(
          `/api/school/students?schoolUserId=${user.id}&limit=10`
        );
        const json = await res.json();
        if (res.ok && json.success) {
          setStudents(json.students || []);
        } else {
          // keep students as null to indicate not loaded or error
          setStudents([]);
        }
      } catch (e) {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [user?.id]);

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              width="64"
              height="64"
              viewBox="0 0 64 64"
              style={{
                animation: "spinDiamond 1.2s linear infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            >
              <rect
                x="12"
                y="12"
                width="40"
                height="40"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="8"
                rx="4"
                ry="4"
                transform="rotate(45 32 32)"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f6d457" />
                  <stop offset="100%" stopColor="#1e3769" />
                </linearGradient>
              </defs>
            </svg>
          ))}
        </div>
        <style>{`
          @keyframes spinDiamond {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <Box p="lg">
        <Paper
          withBorder
          p="lg"
          radius="md"
          style={{ background: "#fee", color: "#c00" }}
        >
          <Text>{error}</Text>
        </Paper>
      </Box>
    );
  }

  const totalStudents = stats?.totalStudents || 0;
  const activeCourses = stats?.activeCourses || 0;
  const totalEnrollments = stats?.totalEnrollments || 0;
  const completionRate = stats?.completionRate || 0;

  return (
    <Box p="lg">
      <Title order={2} mb="xl" style={{ color: "var(--primary-color)" }}>
        Dashboard Sekolah
      </Title>

      <Grid gutter="lg" justify="center">
        <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
          <StatCard
            label="Total Siswa"
            value={totalStudents}
            Icon={IconUsers}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
          <StatCard
            label="Kursus Aktif"
            value={activeCourses}
            Icon={IconBook}
          />
        </Grid.Col>
      </Grid>

      <Paper withBorder p="xl" radius="lg" mt="xl">
        <Title order={3} mb="md">
          Selamat Datang, {user?.fullName}
        </Title>
        <Text c="dimmed" size="sm">
          Kelola siswa dan kursus sekolah Anda dari dashboard ini. Gunakan menu
          navigasi di sebelah kiri untuk mulai.
        </Text>
      </Paper>

      <Grid gutter="lg" mt="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card padding="lg" radius="md" withBorder>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <Title order={3}>Transaksi Terbaru</Title>
                <Text size="sm" c="dimmed">
                  Ringkasan transaksi terakhir untuk sekolah ini
                </Text>
              </div>
            </div>
            <Divider my="sm" />
            <Stack gap="sm">
              {transactions === null && (
                <Text c="dimmed">Memuat transaksi...</Text>
              )}
              {transactions && transactions.length === 0 && (
                <Text c="dimmed">Belum ada transaksi.</Text>
              )}
              {transactions &&
                transactions.map((t) => (
                  <Group key={t.id} style={{ justifyContent: "space-between" }}>
                    <Group>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <Text size="sm" fw={700}>
                          {t.course_title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(t.date).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Text>
                      </div>
                    </Group>
                    <Text
                      size="sm"
                      fw={700}
                      c={
                        t.status === "completed" || t.status === "paid"
                          ? "green"
                          : undefined
                      }
                    >
                      {rupiah(t.amount)}
                    </Text>
                  </Group>
                ))}
            </Stack>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Button
                size="xs"
                variant="light"
                component="a"
                href="/school/profile?tab=purchases"
                style={{
                  color: "var(--primary-color)",
                  borderColor: "var(--primary-color)",
                }}
              >
                Lihat Selengkapnya
              </Button>
            </div>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card padding="lg" radius="md" withBorder>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <Title order={3}>Daftar Siswa</Title>
                <Text size="sm" c="dimmed">
                  Beberapa siswa teratas yang terdaftar di sekolah ini
                </Text>
              </div>
            </div>
            <Divider my="sm" />
            <Stack gap="sm">
              {students === null && <Text c="dimmed">Memuat siswa...</Text>}
              {students && students.length === 0 && (
                <Text c="dimmed">Belum ada siswa terdaftar.</Text>
              )}
              {students &&
                students.map((s) => (
                  <Group key={s.id} style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <Text size="sm" fw={700}>
                        {s.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {s.email}
                      </Text>
                    </div>
                  </Group>
                ))}
            </Stack>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Button
                size="xs"
                variant="light"
                component="a"
                href="/school/students"
                style={{
                  color: "var(--primary-color)",
                  borderColor: "var(--primary-color)",
                }}
              >
                Kelola Siswa
              </Button>
            </div>
          </Card>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
