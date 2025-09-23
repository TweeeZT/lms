"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Container,
  Title,
  Text,
  Grid,
  Card,
  Stack,
  Group,
  Badge,
  Button,
  Progress,
  Alert,
  Skeleton,
} from "@mantine/core";
import {
  IconBook,
  IconTrophy,
  IconTarget,
  IconAward,
  IconReceipt2,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useAuth } from "../../../hooks/useAuth";

// Reusable StatCard (vertical) as requested
function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
}) {
  const bg = "var(--primary-color)";
  const iconBadgeBg = "var(--secondary-color)";
  const textColor = "#ffffff";
  return (
    <Card
      withBorder
      padding="lg"
      radius="md"
      shadow="sm"
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        transition: "transform .25s, box-shadow .25s",
        background: bg,
        minHeight: 170,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 22px -6px rgba(0,0,0,.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--mantine-shadow-sm)";
      }}
    >
      <Text size="xs" c={textColor} fw={600} tt="uppercase" mb={4}>
        {label}
      </Text>
      <div
        style={{
          margin: 16,
          width: 56,
          height: 56,
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: iconBadgeBg,
        }}
      >
        <Icon size={32} color="#1e3769" />
      </div>
      <Title order={2} style={{ lineHeight: 1 }} c={textColor}>
        {value}
      </Title>
    </Card>
  );
}

type DashboardData = {
  success: boolean;
  error?: string;
  user?: { id: string; fullName: string };
  stats?: {
    inProgress: number;
    completed: number;
    xp: number;
    level: number;
    nextLevelXP: number;
  };
  courses?: Array<{
    id: string;
    title: string;
    category: string;
    totalModules: number;
    progress: number;
  }>;
  discussions?: Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
  }>;
  transactions?: Array<{
    id: string;
    date: string;
    course_title: string;
    amount: number;
    status: string;
  }>;
};

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user/dashboard?userId=${user.id}`);
        const json = (await res.json()) as DashboardData;
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal memuat dashboard");
        }
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memuat dashboard");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.id]);

  const currency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  const stats = data?.stats;

  return (
    <Container size="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            Dashboard Belajar
          </Title>
          <Text size="lg" c="dimmed">
            {data?.user?.fullName
              ? `Selamat datang kembali, ${data.user.fullName}!`
              : ""}
          </Text>
        </div>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <Grid gutter="xl">
          {[
            {
              label: "Kursus Aktif",
              value: loading ? (
                <Skeleton height={28} width={40} />
              ) : (
                String(stats?.inProgress || 0)
              ),
              Icon: IconBook,
            },
            {
              label: "Kursus Selesai",
              value: loading ? (
                <Skeleton height={28} width={40} />
              ) : (
                String(stats?.completed || 0)
              ),
              Icon: IconTrophy,
            },
            {
              label: "XP Points",
              value: loading ? (
                <Skeleton height={28} width={60} />
              ) : (
                String(stats?.xp || 0)
              ),
              Icon: IconAward,
            },
            {
              label: "Level",
              value: loading ? (
                <Skeleton height={28} width={50} />
              ) : (
                `Lv ${stats?.level || 1}`
              ),
              Icon: IconTarget,
            },
          ].map(({ label, value, Icon }) => (
            <Grid.Col key={label} span={{ base: 12, md: 6, lg: 3 }}>
              <StatCard label={label} value={value} Icon={Icon} />
            </Grid.Col>
          ))}
        </Grid>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card padding="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Kursus Saya</Title>
                <Text size="sm" c="dimmed">
                  Progres kursus yang sedang Anda ikuti
                </Text>
              </Group>
              <Stack gap="lg">
                {(data?.courses || []).map((course) => (
                  <Card key={course.id} p="md" radius="sm" withBorder>
                    <Group justify="space-between" mb="sm">
                      <Group>
                        <div
                          style={{
                            width: 50,
                            height: 35,
                            background: "var(--gradient-accent)",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {course.category === "scratch" ? "SCR" : "RBX"}
                        </div>
                        <div>
                          <Text fw={600} lineClamp={1}>
                            {course.title}
                          </Text>
                          <Group gap="xs">
                            <Badge
                              size="xs"
                              variant="light"
                              color={
                                course.category === "scratch"
                                  ? "orange"
                                  : "cyan"
                              }
                            >
                              {course.category}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {course.totalModules} modul
                            </Text>
                          </Group>
                        </div>
                      </Group>

                      <Group gap="xs">
                        <Badge
                          variant="light"
                          color={course.progress >= 100 ? "green" : "blue"}
                        >
                          {course.progress >= 100 ? "Selesai" : "Berlangsung"}
                        </Badge>
                        <Button
                          size="xs"
                          variant="light"
                          component={Link}
                          href={`/user/courses`}
                        >
                          {course.progress >= 100 ? "Review" : "Lanjutkan"}
                        </Button>
                      </Group>
                    </Group>

                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Progress</Text>
                      <Text size="sm" fw={600}>
                        {Math.round(course.progress)}%
                      </Text>
                    </Group>
                    <Progress
                      value={course.progress}
                      color={course.progress >= 100 ? "green" : "blue"}
                    />
                  </Card>
                ))}
                {!loading && (data?.courses || []).length === 0 && (
                  <Text c="dimmed">Belum ada kursus yang diikuti.</Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <Card padding="lg" radius="md">
                <Title order={4} mb="md">
                  Level Progress
                </Title>
                <Stack gap="md">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Menuju Level Berikutnya</Text>
                      <Text size="sm" fw={600}>
                        {stats ? `${stats.xp}/${stats.nextLevelXP} XP` : "-"}
                      </Text>
                    </Group>
                    <Progress
                      value={
                        stats
                          ? Math.min(
                              100,
                              (stats.xp / Math.max(1, stats.nextLevelXP)) * 100
                            )
                          : 0
                      }
                      color="green"
                    />
                  </div>
                </Stack>
              </Card>

              <Card padding="lg" radius="md">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Diskusi Terbaru</Title>
                  <Button
                    variant="subtle"
                    size="xs"
                    component={Link}
                    href="/user/discussions"
                  >
                    Lihat semua
                  </Button>
                </Group>
                <Stack gap="sm">
                  {(data?.discussions || []).map((d) => (
                    <div key={d.id}>
                      <Text fw={600} size="sm" lineClamp={1}>
                        {d.title}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {d.content}
                      </Text>
                    </div>
                  ))}
                  {!loading && (data?.discussions || []).length === 0 && (
                    <Text c="dimmed">Belum ada diskusi terbaru.</Text>
                  )}
                </Stack>
              </Card>

              <Card padding="lg" radius="md">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Pembayaran Terbaru</Title>
                </Group>
                <Stack gap="sm">
                  {(data?.transactions || []).map((t) => (
                    <Group key={t.id} justify="space-between">
                      <Group gap="xs">
                        <IconReceipt2 size="1rem" />
                        <div>
                          <Text size="sm" fw={600}>
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
                        {currency(t.amount)}
                      </Text>
                    </Group>
                  ))}
                  {!loading && (data?.transactions || []).length === 0 && (
                    <Text c="dimmed">Belum ada transaksi.</Text>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
