"use client";

import React, { useState, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Grid,
  Card,
  Stack,
  Group,
  Badge,
  Avatar,
  Paper,
  Button,
} from "@mantine/core";
import {
  IconUsers,
  IconBook,
  IconCoin,
  IconChartBar,
} from "@tabler/icons-react";
import Link from "next/link";
// Dummy finance/user/course imports removed; data now fetched from API

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Combined line chart card with legend & tooltips (Revenue + Orders)
function ChartCard({
  revenueNumbers,
  ordersNumbers,
  monthLabels,
}: {
  revenueNumbers: number[];
  ordersNumbers: number[];
  monthLabels: string[];
}) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const height = 170;
  const paddingX = 24;
  const width = 620; // virtual width for viewBox
  const totalPoints = monthLabels.length;
  const stepX = (width - paddingX * 2) / (totalPoints - 1 || 1);
  const maxVal = Math.max(
    ...(showRevenue ? revenueNumbers : [0]),
    ...(showOrders ? ordersNumbers : [0]),
    1
  );

  function buildPath(data: number[]) {
    const pts = data
      .map((v, i) => {
        const x = paddingX + i * stepX;
        const y = height - 32 - (v / maxVal) * (height - 60);
        return `${x},${y}`;
      })
      .join(" ");
    return { pts };
  }

  const revenuePath = buildPath(revenueNumbers);
  const ordersPath = buildPath(ordersNumbers);

  const gridYSteps = 4;
  const gridLines = Array.from({ length: gridYSteps + 1 }, (_, i) => {
    const y = height - 32 - (i / gridYSteps) * (height - 60);
    const val = Math.round((i / gridYSteps) * maxVal);
    return { y, val };
  });

  return (
    <Card
      padding="lg"
      radius="md"
      withBorder
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid var(--mantine-color-gray-3)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,

          pointerEvents: "none",
        }}
      />
      <Group
        justify="space-between"
        align="flex-start"
        mb="sm"
        style={{ position: "relative", zIndex: 2 }}
      >
        <div>
          <Title order={3}>Perkembangan Pendapatan & Orders</Title>
          <Text size="xs" c="dimmed">
            8 bulan terakhir (simulasi)
          </Text>
        </div>
        <Group gap={8} wrap="nowrap">
          <Badge
            onClick={() => setShowRevenue((s) => !s)}
            style={{ cursor: "pointer", opacity: showRevenue ? 1 : 0.4 }}
            color="green"
            variant={showRevenue ? "filled" : "light"}
          >
            Pendapatan
          </Badge>
          <Badge
            onClick={() => setShowOrders((s) => !s)}
            style={{ cursor: "pointer", opacity: showOrders ? 1 : 0.4 }}
            color="blue"
            variant={showOrders ? "filled" : "light"}
          >
            Orders
          </Badge>
        </Group>
      </Group>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          width="100%"
          style={{ minWidth: 560, display: "block" }}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Grid */}
          <g stroke="var(--mantine-color-gray-3)" strokeWidth={1} opacity={0.6}>
            {gridLines.map((g, i) => (
              <g key={i}>
                <line
                  x1={0}
                  x2={width}
                  y1={g.y}
                  y2={g.y}
                  strokeDasharray="4 6"
                />
                <text
                  x={8}
                  y={g.y - 4}
                  fontSize={10}
                  fill="var(--mantine-color-dimmed)"
                >
                  {new Intl.NumberFormat("id-ID").format(g.val)}
                </text>
              </g>
            ))}
          </g>
          {/* Revenue */}
          {showRevenue && (
            <>
              <polyline
                points={revenuePath.pts}
                fill="none"
                stroke="#2f9e44"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </>
          )}
          {/* Orders */}
          {showOrders && (
            <>
              <polyline
                points={ordersPath.pts}
                fill="none"
                stroke="#1c7ed6"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="5 6"
              />
            </>
          )}
          {/* Points & tooltips combined */}
          {monthLabels.map((m, i) => {
            const x = paddingX + i * stepX;
            const rev = revenueNumbers[i];
            const ord = ordersNumbers[i];
            const yRev = height - 32 - (rev / maxVal) * (height - 60);
            const yOrd = height - 32 - (ord / maxVal) * (height - 60);
            const showTip = hoverIndex === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIndex(i)}
                style={{ cursor: "pointer" }}
              >
                {showRevenue && (
                  <circle
                    cx={x}
                    cy={yRev}
                    r={5}
                    fill="#2f9e44"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
                {showOrders && (
                  <circle
                    cx={x}
                    cy={yOrd}
                    r={5}
                    fill="#1c7ed6"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
                {/* Hover zone */}
                <rect
                  x={x - stepX / 2}
                  width={stepX}
                  y={0}
                  height={height}
                  fill="transparent"
                />
                {showTip && (
                  <g>
                    <line
                      x1={x}
                      x2={x}
                      y1={0}
                      y2={height}
                      stroke="#000"
                      strokeDasharray="3 4"
                      opacity={0.15}
                    />
                    <foreignObject
                      x={Math.min(x + 12, width - 160)}
                      y={12}
                      width={150}
                      height={80}
                    >
                      <div
                        style={{
                          background: "rgba(24,24,27,.85)",
                          color: "#fff",
                          padding: "6px 8px",
                          borderRadius: 8,
                          fontSize: 11,
                          lineHeight: 1.4,
                          boxShadow: "0 4px 14px -4px rgba(0,0,0,.4)",
                        }}
                      >
                        <strong style={{ display: "block", marginBottom: 4 }}>
                          {m}
                        </strong>
                        {showRevenue && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>Pendapatan</span>
                            <span>
                              {new Intl.NumberFormat("id-ID").format(rev)}
                            </span>
                          </div>
                        )}
                        {showOrders && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>Orders</span>
                            <span>
                              {new Intl.NumberFormat("id-ID").format(ord)}
                            </span>
                          </div>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                )}
                <text
                  x={x}
                  y={height - 10}
                  fontSize={11}
                  textAnchor="middle"
                  fill="var(--mantine-color-dimmed)"
                >
                  {m}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Text size="xs" c="dimmed" mt="xs">
        Klik legend untuk sembunyikan / tampilkan. Arahkan kursor ke titik untuk
        detail.
      </Text>
    </Card>
  );
}

function SimpleDonut({
  data,
  size = 120,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const stops = data
    .map((d) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${d.color} ${start}deg ${end}deg`;
    })
    .join(", ");
  return (
    <div
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${stops})`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 10,
          borderRadius: "50%",
          background: "var(--mantine-color-body)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          fontSize: 12,
          fontWeight: 600,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontSize: 18, color: "black", fontWeight: 800 }}>
          Total
        </span>
        <span style={{ fontSize: 22, color: "black", fontWeight: 800 }}>
          {total}
        </span>
      </div>
    </div>
  );
}

// Reusable StatCard (vertical) similar style to admin
function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
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

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalCourses: number;
    totalModules: number;
    totalDiscussions: number;
    activeEnrollments: number;
    totalEnrolled: number;
    avgCourseRating: number;
    revenue: { totalRevenue: number; totalOrders: number; avgOrder: number };
  } | null>(null);
  const [distribution, setDistribution] = useState<
    { role: string; value: number }[]
  >([]);
  const [recentUsers, setRecentUsers] = useState<
    {
      id: string;
      fullName: string;
      email: string;
      role: string;
      avatar?: string | null;
    }[]
  >([]);
  const [recentTransactions, setRecentTransactions] = useState<
    {
      id: string;
      courseTitle: string;
      userName: string;
      date: string;
      amount: number;
      status: string;
    }[]
  >([]);
  const [monthLabels, setMonthLabels] = useState<string[]>([]);
  const [revenueNumbers, setRevenueNumbers] = useState<number[]>([]);
  const [ordersNumbers, setOrdersNumbers] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Discover admin id from localStorage or cookie
        let uid: string | null = null;
        try {
          const cached = localStorage.getItem("afterschola_user");
          if (cached) {
            const parsed = JSON.parse(cached);
            uid = parsed.id;
          }
        } catch {}
        if (!uid && typeof document !== "undefined") {
          const m = document.cookie.match(/(?:^|; )a_uid=([^;]+)/);
          if (m) uid = decodeURIComponent(m[1]);
        }
        if (!uid) throw new Error("Tidak menemukan user id");
        const dashRes = await fetch(`/api/admin/dashboard?userId=${uid}`);
        const dashJson = await dashRes.json();
        if (!dashRes.ok || !dashJson.success) {
          throw new Error(dashJson.error || "Gagal memuat dashboard");
        }
        if (!active) return;
        setStats(dashJson.stats);
        setDistribution(dashJson.roleDistribution || []);
        // recent users
        const usersRes = await fetch(
          `/api/admin/users?userId=${uid}&page=1&limit=5&sortBy=created_at&sortDir=desc`
        );
        const usersJson = await usersRes.json();
        if (usersRes.ok && usersJson.success) {
          interface RawUser {
            id: string;
            name?: string;
            full_name?: string;
            email?: string;
            role?: string;
            avatar_url?: string | null;
          }
          const mapped = ((usersJson.items || []) as RawUser[]).map((u) => ({
            id: u.id,
            fullName: u.name || u.full_name || "-",
            email: u.email || "",
            role: u.role || "user",
            avatar: u.avatar_url || null,
          }));
          setRecentUsers(mapped);
        }
        // recent transactions
        const txRes = await fetch(
          `/api/admin/earnings?userId=${uid}&page=1&limit=5&sortBy=date&sortDir=desc`
        );
        const txJson = await txRes.json();
        if (txRes.ok && txJson.success) {
          interface RawTx {
            id: string;
            course_title: string;
            user_name: string;
            date: string;
            amount: number;
            status: string;
          }
          const mappedTx = ((txJson.items || []) as RawTx[]).map((t) => ({
            id: t.id,
            courseTitle: t.course_title,
            userName: t.user_name,
            date: t.date,
            amount: t.amount,
            status: t.status,
          }));
          setRecentTransactions(mappedTx);
          const byMonth = new Map<string, { rev: number; orders: number }>();
          mappedTx.forEach(
            (t: { date: string; status: string; amount: number }) => {
              const d = new Date(t.date);
              const key = d.toLocaleDateString("id-ID", {
                month: "short",
                year: "2-digit",
              });
              if (!byMonth.has(key)) byMonth.set(key, { rev: 0, orders: 0 });
              const entry = byMonth.get(key)!;
              if (t.status === "paid") {
                entry.rev += Number(t.amount || 0);
                entry.orders += 1;
              }
            }
          );
          const monthArr = Array.from(byMonth.entries());
          monthArr.sort(
            (a, b) =>
              new Date("01 " + a[0]).getTime() -
              new Date("01 " + b[0]).getTime()
          );
          setMonthLabels(monthArr.map((m) => m[0]));
          setRevenueNumbers(monthArr.map((m) => m[1].rev));
          setOrdersNumbers(monthArr.map((m) => m[1].orders));
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Gagal memuat data");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const totalUsers = stats?.totalUsers || 0;
  const totalCourses = stats?.totalCourses || 0;
  const totalRevenue = stats?.revenue.totalRevenue || 0;
  const activeStudents = stats?.activeEnrollments || 0;
  const donutData = distribution.map((r) => ({
    label:
      r.role === "admin"
        ? "Admin"
        : r.role === "instructor"
        ? "Instruktur"
        : r.role === "school"
        ? "Sekolah"
        : r.role === "user"
        ? "Siswa"
        : r.role || "",
    value: r.value,
    color:
      r.role === "admin"
        ? "#093569"
        : r.role === "instructor"
        ? "#4b7d90"
        : "#fcac0f",
  }));

  if (loading) {
    // Let AdminLayout show the global PrimeLoader overlay; avoid rendering partial content
    return null;
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            Dashboard Admin
          </Title>
          <Text size="lg" c="dimmed">Overview dan manajemen platform AfterSchola</Text>
          {error && (
            <Text size="sm" c="red" mt={4}>
              {error}
            </Text>
          )}
        </div>

        {/* Stats Cards (vertical layout) */}
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard label="Total Users" value={totalUsers} Icon={IconUsers} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard label="Total Kursus" value={totalCourses} Icon={IconBook} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Total Revenue"
              value={`Rp ${totalRevenue.toLocaleString()}`}
              Icon={IconCoin}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard label="Siswa Aktif" value={activeStudents} Icon={IconChartBar} />
          </Grid.Col>
        </Grid>

        {/* Charts and recent activity */}
        <Grid gutter="xl" align="stretch">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg">
              <ChartCard
                revenueNumbers={revenueNumbers}
                ordersNumbers={ordersNumbers}
                monthLabels={monthLabels}
              />

              <Paper
                p="md"
                radius="md"
                withBorder
                style={{
                  position: "relative",
                  overflow: "hidden",
                  border: "1px solid var(--mantine-color-gray-3)",
                }}
              >
                <Group justify="space-between" mb="sm">
                  <Title order={3}>Transaksi Terbaru</Title>
                </Group>
                <Stack gap="md">
                  {recentTransactions.slice(0, 3).map((t) => (
                    <Group key={t.id} justify="space-between" wrap="nowrap">
                      <div>
                        <Text fw={600}>{t.courseTitle}</Text>
                        <Text size="xs" c="dimmed">
                          {t.userName} •{" "}
                          {new Date(t.date).toLocaleString("id-ID")}
                        </Text>
                      </div>
                      <Badge
                        variant="light"
                        color={
                          t.status === "paid"
                            ? "teal"
                            : t.status === "pending"
                            ? "yellow"
                            : "red"
                        }
                      >
                        {rupiah(t.amount)}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
                <Button
                  component={Link}
                  href="/admin/earnings"
                  fullWidth
                  mt="md"
                  size="sm"
                  style={{ background: "#1e3769", color: "#fff", border: "none" }}
                >
                  Lihat selengkapnya
                </Button>
              </Paper>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <Card padding="lg" radius="md" withBorder>
                <Title order={4} mb="md">
                  Distribusi Role
                </Title>
                <Group justify="center" my="md">
                  <SimpleDonut data={donutData} />
                </Group>
                <Stack gap={6}>
                  {donutData.map((d) => {
                    return (
                      <Group key={d.label} justify="space-between">
                        <Group gap="xs">
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              background: d.color,
                              display: "inline-block",
                              borderRadius: 2,
                            }}
                          />
                          <Text>{d.label}</Text>
                        </Group>
                        <Badge variant="light">{d.value}</Badge>
                      </Group>
                    );
                  })}
                </Stack>
              </Card>

              <Card
                padding="lg"
                radius="md"
                withBorder
                style={{
                  border: "1px solid var(--mantine-color-gray-3)",
                }}
              >
                <Group justify="space-between" mb="md">
                  <Title order={4}>Pengguna Terbaru</Title>
                </Group>
                <Stack gap="sm">
                  {recentUsers.slice(-3).map((user) => (
                    <Group key={user.id} justify="space-between" wrap="nowrap">
                      <div>
                        <Text fw={600}>{user.fullName}</Text>
                        <Text size="xs" c="dimmed">
                          {user.email}
                        </Text>
                      </div>
                      <Badge
                        variant="light"
                        color={
                          user.role === "admin"
                            ? "red"
                            : user.role === "instructor"
                            ? "blue"
                            : "green"
                        }
                      >
                        {user.role === "admin"
                          ? "Admin"
                          : user.role === "instructor"
                          ? "Instruktur"
                          : user.role === "school"
                          ? "Sekolah"
                          : user.role === "user"
                          ? "Siswa"
                          : user.role}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
                <Button
                  component={Link}
                  href="/admin/users"
                  fullWidth
                  mt="md"
                  size="sm"
                  style={{ background: "#1e3769", color: "#fff", border: "none" }}
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
