"use client";

import React, { useState } from "react";
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
import { dummyUsers, getStudents } from "../../../data/users";
import { dummyCourses } from "../../../data/courses";
import Link from "next/link";
import {
  monthlyRevenue,
  transactionsSeed,
  roleDistribution,
  computeFinanceSummary,
} from "../../../data/finance";

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

// Reusable stat card with vertical layout (label -> icon -> value) used in dashboard metrics section
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
  gradientFrom,
  gradientTo,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  onClick?: () => void;
  gradientFrom?: string;
  gradientTo?: string;
}) {
  return (
    <Card
      padding="lg"
      radius="md"
      withBorder
      shadow="sm"
      onClick={onClick}
      style={
        {
          cursor: onClick ? "pointer" : undefined,
          transition: "transform .25s, box-shadow .25s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(135deg,var(--mantine-color-${color}-0),var(--mantine-color-${color}-1))`,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 22px -6px rgba(0,0,0,.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--mantine-shadow-sm)";
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
        {label}
      </Text>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${gradientFrom || color}40, ${
            gradientTo || color
          }15)`,
          marginBottom: 8,
        }}
      >
        <Icon size={30} color={color} />
      </div>
      <Title order={2} c={color} style={{ lineHeight: 1 }}>
        {value}
      </Title>
    </Card>
  );
}

export default function AdminDashboard() {
  const totalUsers = dummyUsers.length;
  const totalCourses = dummyCourses.length;
  const finSummary = computeFinanceSummary(transactionsSeed, []);
  const totalRevenue = finSummary.totalRevenue;
  const activeStudents = getStudents().length;

  const recentUsers = dummyUsers.slice(-5);
  const recentTransactions = transactionsSeed.slice(0, 5);
  const revenueNumbers = monthlyRevenue.map((m) => m.revenue);
  const ordersNumbers = monthlyRevenue.map((m) => m.orders);
  const monthLabels = monthlyRevenue.map((m) => m.month);
  const donutData = roleDistribution.map((r) => ({
    label: r.role,
    value: r.value,
    color:
      r.role === "admin"
        ? "#093569"
        : r.role === "instructor"
        ? "#4b7d90"
        : "#fcac0f",
  }));

  return (
    <Container size="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            Dashboard Admin
          </Title>
          <Text size="lg" c="dimmed">
            Overview dan manajemen platform AfterSchola
          </Text>
        </div>

        {/* Stats Cards (vertical layout) */}
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Total Users"
              value={totalUsers}
              icon={IconUsers}
              color="blue"
              gradientFrom="#4e8df7"
              gradientTo="#1c4e91"
              onClick={() => (window.location.href = "/admin/users")}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Total Kursus"
              value={totalCourses}
              icon={IconBook}
              color="indigo"
              gradientFrom="#4c51bf"
              gradientTo="#2c3e50"
              onClick={() => (window.location.href = "/admin/courses")}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Total Revenue"
              value={`Rp ${totalRevenue.toLocaleString()}`}
              icon={IconCoin}
              color="green"
              gradientFrom="#3fbf7d"
              gradientTo="#0f6434"
              onClick={() => (window.location.href = "/admin/earnings")}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              label="Siswa Aktif"
              value={activeStudents}
              icon={IconChartBar}
              color="orange"
              gradientFrom="#ffb347"
              gradientTo="#c96b07"
              onClick={() => (window.location.href = "/admin/users")}
            />
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
                  variant="gradient"
                  gradient={{ from: "#f6d457", to: "#1e3769", deg: 100 }}
                  fullWidth
                  mt="md"
                  size="sm"
                  styles={(theme) => ({
                    root: {
                      color: theme.white,
                      border: "none",
                    },
                  })}
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
                      <Group>
                        <Avatar src={user.avatar} size="sm" radius="xl">
                          {user.fullName
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </Avatar>
                        <div>
                          <Text fw={600}>{user.fullName}</Text>
                          <Text size="xs" c="dimmed">
                            {user.email}
                          </Text>
                        </div>
                      </Group>
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
                        {user.role}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
                <Button
                  component={Link}
                  href="/admin/users"
                  variant="gradient"
                  gradient={{ from: "#f6d457", to: "#1e3769", deg: 100 }}
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
