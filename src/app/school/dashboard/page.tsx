"use client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { Box, Title, Paper, Grid, Text, Loader } from "@mantine/core";
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
  }, [user?.id]);

  if (loading) {
    return (
      <Box
        p="lg"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Loader size="lg" />
      </Box>
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

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Siswa"
            value={totalStudents}
            Icon={IconUsers}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Kursus Aktif"
            value={activeCourses}
            Icon={IconBook}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Enrollment"
            value={totalEnrollments}
            Icon={IconCertificate}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Tingkat Penyelesaian"
            value={`${completionRate.toFixed(1)}%`}
            Icon={IconTrendingUp}
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
    </Box>
  );
}
