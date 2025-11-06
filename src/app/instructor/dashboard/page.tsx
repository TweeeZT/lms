"use client";

import { Container, Title, Text, Grid, Card, Stack, Group, Badge, Button, Avatar, Skeleton } from "@mantine/core";
import {
  IconBook,
  IconUsers,
  IconCoin,
  IconChartBar,
} from "@tabler/icons-react";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../../hooks/useAuth";
// Note: We handle our own initial overlay loader on this page to match user discussions.

type ApiProfile = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar?: string | null;
};

type ApiInstructor = {
  user_id: string;
  total_earnings?: number | null;
  rating?: number | null;
  bank_account?: string | null;
} | null;

type ApiCourse = {
  id: string;
  title: string;
  thumbnail: string | null;
  category: string;
  price: number | null;
  duration_min: number | null;
  level: string;
  total_modules: number | null;
  enrolled_count: number | null;
  rating: number | null;
  is_published: boolean | null;
  created_at: string;
  updated_at: string;
};

type ApiPurchase = {
  id: string;
  amount: number;
  date: string; // ISO
  courseId: string;
  courseTitle: string;
  userId: string;
  userName: string;
  userEmail?: string | null;
};

type ApiMonthly = { month: string; revenue: number; orders: number };

type DashboardResponse = {
  success: boolean;
  profile: ApiProfile;
  instructor: ApiInstructor;
  stats: {
    coursesCount: number;
    totalStudents: number;
    totalEarnings: number;
    avgRating: number;
  };
  courses: ApiCourse[];
  payouts: Array<{ id: string; amount: number; date: string; status: string }>;
  purchases: ApiPurchase[];
  monthly: ApiMonthly[];
};

// Reusable StatCard (vertical) similar style to admin
function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  gradientFrom?: string;
  gradientTo?: string;
}) {
  // Use brand gradient and soft frosted icon badge
  const bg = "var(--primary-color)"; // defined in globals.css
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

export default function InstructorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  // Month navigation: 0 means current month window; 1 means window ending previous month, etc.
  const [offsetMonths, setOffsetMonths] = useState(0);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          instructorId: user.id,
          offsetMonths: String(offsetMonths),
          months: String(6),
        });
        const res = await fetch(`/api/instructor/dashboard?${params}`);
        const json: DashboardResponse = await res.json();
        if (!res.ok || !json.success) {
          const errMsg =
            (json as Partial<{ error: string }>).error ||
            "Gagal memuat dashboard";
          throw new Error(errMsg);
        }
        // Fallback: if courses list is empty but count > 0, hydrate from courses endpoint
        if (
          (json.courses?.length || 0) === 0 &&
          (json.stats?.coursesCount || 0) > 0
        ) {
          try {
            const p = new URLSearchParams({
              instructorId: user.id,
              page: "1",
              limit: "6",
              status: "all",
            });
            const res2 = await fetch(`/api/instructor/courses?${p.toString()}`);
            const j2 = await res2.json();
            if (res2.ok && j2?.success && Array.isArray(j2.items)) {
              json.courses = j2.items as any;
            }
          } catch {}
        }
        if (!ignore) setData(json);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        if (!ignore) {
          setLoading(false);
          setInitialLoad(false);
        }
      }
    };
    if (!authLoading && user) load();
    return () => {
      ignore = true;
    };
  }, [authLoading, user, offsetMonths]);

  // Make numbers compact and prevent wrapping
  const formatCurrency = (n: number) => {
    if (n >= 1000000) {
      // 1 juta atau lebih
      const jutaVal = n / 1000000;
      return `Rp ${jutaVal.toFixed(1).replace(".", ",")}jt`;
    }
    if (n >= 1000) {
      // 1 ribu atau lebih
      const ribuVal = n / 1000;
      return `Rp ${ribuVal.toFixed(0)}rb`;
    }
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "-";
    try {
      const dt = typeof d === "string" ? new Date(d) : d;
      if (isNaN(dt.getTime())) return "-";
      const day = dt.getDate().toString().padStart(2, "0");
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agt",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      const dayNames = [
        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
      ];
      const month = monthNames[dt.getMonth()];
      const year = dt.getFullYear();
      const dayName = dayNames[dt.getDay()];
      return `${dayName}, ${day} ${month} ${year}`;
    } catch {
      return "-";
    }
  };

  const formatMonth = (monthStr: string) => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agt",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const date = new Date(monthStr + "-01");
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Trend from API
  const earningsTrend = useMemo(() => {
    const list = data?.monthly || [];
    return list.map((m, i) => ({ ...m, idx: i }));
  }, [data]);

  // Legend toggles
  const [showRevenue, setShowRevenue] = useState(true);
  const [showOrders, setShowOrders] = useState(true);

  const maxVal = Math.max(
    ...(showRevenue ? earningsTrend.map((d) => d.revenue) : [0]),
    ...(showOrders ? earningsTrend.map((d) => d.orders) : [0]),
    1
  );

  const chartH = 220;
  const chartW = 640;
  const padding = 40;

  function buildPolyline(field: "revenue" | "orders") {
    return earningsTrend
      .map((d, i) => {
        const x =
          padding +
          (i * (chartW - padding * 2)) / Math.max(earningsTrend.length - 1, 1);
        const val = d[field];
        const y = padding + (1 - val / maxVal) * (chartH - padding * 2);
        return `${i ? "L" : "M"}${x},${y}`;
      })
      .join(" ");
  }

  const revenuePath = buildPolyline("revenue");
  const ordersPath = buildPolyline("orders");

  // map API -> UI
  const myCourses = useMemo(() => {
    return (data?.courses || []).map((c) => ({
      id: c.id,
      title: c.title,
      enrolledCount: c.enrolled_count || 0,
      totalModules: c.total_modules || 0,
      isPublished: !!c.is_published,
      price: c.price || 0,
    }));
  }, [data]);

  const recentPurchases = useMemo(() => {
    return (data?.purchases || []).slice(0, 5).map((p) => ({
      id: p.id,
      courseTitle: p.courseTitle,
      userName: p.userName,
      amount: p.amount,
      date: new Date(p.date),
    }));
  }, [data]);

  const totalStudents = data?.stats.totalStudents || 0;
  const totalEarnings = data?.stats.totalEarnings || 0;
  const avgRating = data?.stats.avgRating || 0;

  // Initial, one-time full-screen overlay loader (same style as user discussions)
  if ((authLoading || loading) && initialLoad) {
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

  if (!user || !data) {
    return (
      <Container size="xl">
        <Stack gap="md">
          <Title order={3}>Tidak dapat memuat dashboard</Title>
          <Text c="red">{error || "Silakan coba lagi nanti."}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        {/* Hero card */}
        <Card
          padding="lg"
          radius="lg"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "var(--primary-color)", // fallback solid color
            color: "white",
          }}
        >
          {/* Circle accent */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -80,
              top: -60,
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "var(--secondary-color)",
            }}
          />
          <Group
            justify="space-between"
            align="center"
            style={{ position: "relative", zIndex: 1 }}
          >
            <Group>
              <div>
                <Title order={2} c="white">
                  Selamat datang, {data.profile.full_name || user.fullName}
                </Title>
                <Text c="white" opacity={0.85}>
                  Kelola kursus, pantau pendapatan, dan lihat aktivitas terbaru.
                </Text>
              </div>
            </Group>
          </Group>
        </Card>

        {/* Stats */}
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Kursus Saya"
              value={data?.stats.coursesCount ?? myCourses.length}
              Icon={IconBook}
              color="blue"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Total Siswa Dalam Kursus"
              value={totalStudents}
              Icon={IconUsers}
              color="grape"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Total Penghasilan"
              value={formatCurrency(totalEarnings)}
              Icon={IconCoin}
              color="green"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Rata-Rata Rating"
              value={avgRating.toFixed(1)}
              Icon={IconChartBar}
              color="yellow"
            />
          </Grid.Col>
        </Grid>

        {/* New two-column layout: Left (Chart + Courses) | Right (Profile + Purchases) */}
        <Grid gutter="xl" align="stretch">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg">
              {/* Chart */}
              <Card
                withBorder
                padding="lg"
                radius="md"
                style={{ position: "relative" }}
              >
                <Group justify="space-between" mb="md">
                  <Title order={3}>Performa Bulanan</Title>
                </Group>
                {loading && !initialLoad ? (
                  <Stack gap={8}>
                    <Skeleton height={18} width={140} />
                    <Skeleton height={chartH} radius="md" />
                    <Group gap={8} mt="xs">
                      <Skeleton height={24} width={110} />
                      <Skeleton height={24} width={90} />
                    </Group>
                  </Stack>
                ) : (
                  <div style={{ width: "100%", overflowX: "auto" }}>
                    <svg
                      viewBox={`0 0 ${chartW} ${chartH}`}
                      width="100%"
                      style={{ minWidth: 560, display: "block" }}
                    >
                      {/* Grid lines */}
                      {Array.from({ length: 4 }, (_, i) => {
                        const y = padding + (i * (chartH - padding * 2)) / 3;
                        const val = Math.round((1 - i / 3) * maxVal);
                        return (
                          <g key={i} opacity={0.4}>
                            <line
                              x1={padding - 10}
                              x2={chartW - padding + 10}
                              y1={y}
                              y2={y}
                              stroke="var(--mantine-color-gray-4)"
                              strokeDasharray="4 6"
                            />
                            <text
                              x={8}
                              y={y - 4}
                              fontSize={10}
                              fill="var(--mantine-color-dimmed)"
                            >
                              {new Intl.NumberFormat("id-ID").format(val)}
                            </text>
                          </g>
                        );
                      })}
                      {/* Revenue line */}
                      {showRevenue && (
                        <path
                          d={revenuePath}
                          fill="none"
                          stroke="var(--mantine-color-green-6)"
                          strokeWidth={3}
                          strokeLinecap="round"
                        />
                      )}
                      {/* Orders line */}
                      {showOrders && (
                        <path
                          d={ordersPath}
                          fill="none"
                          stroke="var(--mantine-color-blue-6)"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeDasharray="5 6"
                        />
                      )}
                      {/* Points + tooltip */}
                      {earningsTrend.map((d, i) => {
                        const x =
                          padding +
                          (i * (chartW - padding * 2)) /
                            Math.max(earningsTrend.length - 1, 1);
                        const yRev =
                          padding +
                          (1 - d.revenue / maxVal) * (chartH - padding * 2);
                        const yOrd =
                          padding +
                          (1 - d.orders / maxVal) * (chartH - padding * 2);

                        return (
                          <g key={d.idx}>
                            {showRevenue && (
                              <circle
                                cx={x}
                                cy={yRev}
                                r={5}
                                fill="var(--mantine-color-green-6)"
                                stroke="#fff"
                                strokeWidth={2}
                              >
                                <title>
                                  {formatMonth(d.month)}
                                  {"\n"}Pendapatan:{" "}
                                  {new Intl.NumberFormat("id-ID").format(
                                    d.revenue
                                  )}
                                </title>
                              </circle>
                            )}
                            {showOrders && (
                              <circle
                                cx={x}
                                cy={yOrd}
                                r={5}
                                fill="var(--mantine-color-blue-6)"
                                stroke="#fff"
                                strokeWidth={2}
                              >
                                <title>
                                  {formatMonth(d.month)}
                                  {"\n"}Orders:{" "}
                                  {new Intl.NumberFormat("id-ID").format(
                                    d.orders
                                  )}
                                </title>
                              </circle>
                            )}
                          </g>
                        );
                      })}

                      {/* Month labels */}
                      {earningsTrend.map((d, i) => {
                        const x =
                          padding +
                          (i * (chartW - padding * 2)) /
                            Math.max(earningsTrend.length - 1, 1);
                        return (
                          <text
                            key={d.idx}
                            x={x}
                            y={chartH - 12}
                            fontSize={11}
                            textAnchor="middle"
                            fill="var(--mantine-color-dimmed)"
                          >
                            {formatMonth(d.month).split(" ")[0]}
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                )}
                <Group gap={8} mt="xs">
                  <Badge
                    onClick={() => setShowRevenue((s) => !s)}
                    style={{
                      cursor: "pointer",
                      opacity: showRevenue ? 1 : 0.4,
                    }}
                    color="green"
                    variant={showRevenue ? "filled" : "light"}
                  >
                    Pendapatan
                  </Badge>
                  <Badge
                    onClick={() => setShowOrders((s) => !s)}
                    style={{
                      cursor: "pointer",
                      opacity: showOrders ? 1 : 0.4,
                    }}
                    color="blue"
                    variant={showOrders ? "filled" : "light"}
                  >
                    Orders
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Klik legend untuk sembunyikan / tampilkan.
                </Text>
              </Card>

              {/* Courses (limit 3) */}
              <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                  Kursus Saya
                </Title>
                <Stack gap={12} style={{ fontSize: 13 }}>
                  {loading && !initialLoad ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Group key={i} justify="space-between" align="center">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Skeleton height={12} width="70%" mb={6} />
                          <Skeleton height={10} width="40%" />
                        </div>
                        <Skeleton height={22} width={64} radius="xl" />
                      </Group>
                    ))
                  ) : (
                    myCourses.slice(0, 3).map((c) => (
                      <Group
                        key={c.id}
                        justify="space-between"
                        align="flex-start"
                      >
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} lineClamp={1}>
                            {c.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {c.enrolledCount} siswa • {c.totalModules} modul
                          </Text>
                        </div>
                        <Badge
                          variant="light"
                          color={c.isPublished ? "teal" : "gray"}
                        >
                          {c.isPublished ? "Tayang" : "Draf"}
                        </Badge>
                      </Group>
                    ))
                  )}
                </Stack>
                <Button
                  component={Link}
                  href="/instructor/courses"
                  bg="var(--primary-color)"
                  fullWidth
                  mt="md"
                  size="sm"
                >
                  Lihat selengkapnya
                </Button>
              </Card>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              {/* Profile card */}
              <Card
                withBorder
                padding="lg"
                radius="md"
                style={{ textAlign: "center" }}
              >
                <Stack gap="xs" align="center">
                  <Avatar
                    src={data.profile.avatar || undefined}
                    radius="xl"
                    size={72}
                  >
                    {data.profile.full_name?.[0]}
                  </Avatar>

                  <Title order={4} lineClamp={1}>
                    {data.profile.full_name || user.fullName}
                  </Title>

                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {data.profile.email}
                  </Text>

                  {data.instructor?.bank_account && (
                    <Text
                      size="sm"
                      style={{
                        backgroundColor: "#1e3769",
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: "8px",
                        marginTop: 8,
                        display: "inline-block",
                      }}
                    >
                      Rekening: {data.instructor.bank_account}
                    </Text>
                  )}
                </Stack>
              </Card>

              {/* Purchases 3 */}
              <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                  Pembelian Terbaru
                </Title>
                <Stack gap={12} style={{ fontSize: 13 }}>
                  {loading && !initialLoad ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Group key={i} justify="space-between" wrap="nowrap">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Skeleton height={12} width="60%" mb={6} />
                          <Skeleton height={10} width="50%" mb={6} />
                          <Skeleton height={10} width="40%" />
                        </div>
                        <Skeleton height={14} width={90} />
                      </Group>
                    ))
                  ) : recentPurchases.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      Belum ada transaksi
                    </Text>
                  ) : (
                    <>
                      {recentPurchases.slice(0, 3).map((p) => (
                        <Group key={p.id} justify="space-between" wrap="nowrap">
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600} lineClamp={1}>
                              {p.userName}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {p.courseTitle}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatDate(p.date)}
                            </Text>
                          </div>
                          <Text
                            size="sm"
                            fw={700}
                            c="green"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {formatCurrency(p.amount)}
                          </Text>
                        </Group>
                      ))}
                    </>
                  )}
                </Stack>
                <Button
                  component={Link}
                  href="/instructor/earnings"
                  bg="var(--primary-color)"
                  fullWidth
                  mt="md"
                  size="sm"
                >
                  Lihat selengkapnya
                </Button>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
