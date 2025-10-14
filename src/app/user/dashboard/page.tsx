"use client";

import { useEffect, useState, useCallback } from "react";
import dayjs from "dayjs";
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
  Alert,
  Skeleton,
  Modal,
  TextInput,
  Textarea,
  Select,
  ActionIcon,
  ScrollArea,
  Divider,
  Progress as MantineProgress,
  Paper,
} from "@mantine/core";
import {
  IconBook,
  IconAward,
  IconReceipt2,
  IconAlertCircle,
  IconCalendarPlus,
  IconListDetails,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconSum,
} from "@tabler/icons-react";
import { useAuth } from "../../../hooks/useAuth";
import PrimeLoader from "../../../components/PrimeLoader";

// StatCard component (kept minimal)
function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
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
        background: "var(--primary-color)",
        color: "#fff",
        minHeight: 170,
      }}
    >
      <Text size="xs" fw={600} tt="uppercase" mb={4} c="#fff">
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
          background: "var(--secondary-color)",
        }}
      >
        <Icon size={32} color="#1e3769" />
      </div>
      <Title order={2} c="#fff">
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
    activeCourses: number;
    xp: number;
    points?: number;
    coins?: number;
    completed?: number;
    tier?: string;
  };
  courses?: Array<{
    id: string;
    title: string;
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

interface ScheduleEvent {
  id: string;
  title: string;
  category: "belajar" | "tugas" | "live";
  description?: string | null;
  start: string; // ISO
  end?: string | null;
  userId?: string; // server side
}
const categoryColor: Record<ScheduleEvent["category"], string> = {
  belajar: "blue",
  tugas: "orange",
  live: "green",
};

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/user/dashboard?userId=${user.id}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as DashboardData & {
          stats?: unknown;
        };
        type Diagnostic = {
          rawPoints?: number | null;
          rawCoins?: number | null;
          rawBalance?: number | null;
          inProgress?: number;
          studentFound?: boolean;
        };
        const diagUnknown = (
          json as unknown as { stats?: Record<string, unknown> }
        )?.stats?.["_diagnostic"];
        const d: Diagnostic | null =
          diagUnknown && typeof diagUnknown === "object"
            ? (diagUnknown as Diagnostic)
            : null;
        if (d && json.stats) {
          // ALWAYS override with raw database values if they exist (>0)
          if (typeof d.rawPoints === "number" && d.rawPoints >= 0) {
            json.stats.points = Number(d.rawPoints);
          }
          if (typeof d.rawCoins === "number" && d.rawCoins >= 0) {
            json.stats.coins = Number(d.rawCoins);
          } else if (typeof d.rawBalance === "number" && d.rawBalance >= 0) {
            // fallback to balance if coins null in DB
            json.stats.coins = Number(d.rawBalance);
          }
          if (
            typeof d.inProgress === "number" &&
            typeof json.stats.completed === "number"
          ) {
            const expected = d.inProgress + (json.stats.completed || 0);
            json.stats.activeCourses = expected;
          }
        }
        console.log("dashboardDiagnostic", d);
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat dashboard");
        setData(json);
        // Fallback: if coins & points still zero while we have user, fetch lightweight stats endpoint
        if (
          json?.stats &&
          user?.id &&
          ((json.stats.points ?? 0) === 0 || (json.stats.coins ?? 0) === 0)
        ) {
          try {
            const sRes = await fetch(`/api/user/stats?userId=${user.id}`, {
              cache: "no-store",
            });
            const sJson = await sRes.json();
            if (sRes.ok && sJson.success) {
              setData((prev) =>
                prev && prev.stats
                  ? {
                      ...prev,
                      stats: {
                        ...prev.stats!,
                        points:
                          (prev.stats!.points ?? 0) === 0 &&
                          typeof sJson.points === "number"
                            ? sJson.points
                            : prev.stats!.points,
                        coins:
                          (prev.stats!.coins ?? 0) === 0 &&
                          typeof sJson.coins === "number"
                            ? sJson.coins
                            : prev.stats!.coins,
                      },
                    }
                  : prev
              );
            }
          } catch {}
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memuat dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const stats = data?.stats;

  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(dayjs());
  const [addOpen, setAddOpen] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evCategory, setEvCategory] =
    useState<ScheduleEvent["category"]>("belajar");
  const [evDesc, setEvDesc] = useState("");
  const [evStart, setEvStart] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [evEnd, setEvEnd] = useState<string>("");

  const monthStart = calendarMonth.startOf("month");
  const monthEnd = calendarMonth.endOf("month");
  const daysInMonth: dayjs.Dayjs[] = [];
  for (
    let d = monthStart;
    d.isBefore(monthEnd) || d.isSame(monthEnd, "day");
    d = d.add(1, "day")
  )
    daysInMonth.push(d);
  const firstWeekday = monthStart.day();
  const calendarCells: Array<{ date: dayjs.Dayjs | null }> = [];
  for (let i = 0; i < firstWeekday; i++) calendarCells.push({ date: null });
  daysInMonth.forEach((d) => calendarCells.push({ date: d }));
  const eventsByDay: Record<string, ScheduleEvent[]> = {};
  scheduleEvents.forEach((ev) => {
    const start = dayjs(ev.start);
    const end = ev.end ? dayjs(ev.end) : start;
    for (
      let d = start;
      d.isBefore(end) || d.isSame(end, "day");
      d = d.add(1, "day")
    ) {
      const k = d.format("YYYY-MM-DD");
      (eventsByDay[k] = eventsByDay[k] || []).push(ev);
    }
  });

  const currency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  // CRUD schedule events
  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    try {
      setEventsError(null);
      const res = await fetch(`/api/user/schedule-events?userId=${user.id}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal memuat jadwal");
      setScheduleEvents(json.events || []);
    } catch (e: unknown) {
      setEventsError(e instanceof Error ? e.message : "Gagal memuat jadwal");
    } finally {
    }
  }, [user?.id]);
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const resetForm = () => {
    setEvTitle("");
    setEvCategory("belajar");
    setEvDesc("");
    setEvStart(dayjs().format("YYYY-MM-DD"));
    setEvEnd("");
  };

  const addEvent = async () => {
    if (!user?.id || !evTitle) return;
    try {
      const body = {
        userId: user.id,
        title: evTitle.trim(),
        category: evCategory,
        description: evDesc.trim() || null,
        startDate: evStart,
        endDate: evEnd || null,
      };
      const res = await fetch(`/api/user/schedule-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menambah jadwal");
      // Optimistic append (API returns inserted row(s))
      const inserted: ScheduleEvent | undefined =
        json.event || json.events?.[0];
      if (inserted) setScheduleEvents((prev) => [...prev, inserted]);
      setAddOpen(false);
      resetForm();
    } catch (e: unknown) {
      setEventsError(e instanceof Error ? e.message : "Gagal menambah jadwal");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const confirmDelete = (id: string) => setDeleteId(id);
  const doDelete = async () => {
    if (!deleteId || !user?.id) return;
    try {
      const res = await fetch(
        `/api/user/schedule-events/${deleteId}?userId=${user.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menghapus");
      setScheduleEvents((prev) => prev.filter((e) => e.id !== deleteId));
      setDeleteId(null);
    } catch (e: unknown) {
      setEventsError(e instanceof Error ? e.message : "Gagal menghapus jadwal");
    }
  };

  if (loading) {
    return <PrimeLoader />;
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        \n
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
                String(stats?.activeCourses || 0)
              ),
              Icon: IconBook,
            },
            {
              label: "Total Koin",
              value: loading ? (
                <Skeleton height={28} width={60} />
              ) : (
                String(stats?.coins || 0)
              ),
              Icon: IconReceipt2,
            },
            {
              label: "Poin",
              value: loading ? (
                <Skeleton height={28} width={60} />
              ) : (
                String(stats?.points || 0)
              ),
              Icon: IconSum,
            },
            {
              label: "Tier",
              value: loading ? (
                <Skeleton height={28} width={80} />
              ) : (
                String(stats?.tier || "newbie").toUpperCase()
              ),
              Icon: IconAward,
            },
          ].map(({ label, value, Icon }) => (
            <Grid.Col key={label} span={{ base: 12, md: 6, lg: 3 }}>
              <StatCard label={label} value={value} Icon={Icon} />
            </Grid.Col>
          ))}
        </Grid>
        {/* Row 1 */}
        <Grid gutter="xl" align="stretch">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={4}>Kursus Aktif</Title>
                    <Text size="sm" c="dimmed">
                      Kursus yang sedang kamu ikuti
                    </Text>
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    component={Link}
                    href="/user/courses"
                    style={{
                      color: "var(--primary-color)",
                      borderColor: "var(--primary-color)",
                    }}
                  >
                    Lihat Selengkapnya
                  </Button>
                </Group>

                <Grid gutter="md">
                  {(data?.courses || []).slice(0, 3).map((course) => {
                    const done = course.progress >= 100;
                    return (
                      <Grid.Col
                        key={course.id}
                        span={{ base: 12, sm: 6, md: 4 }}
                      >
                        <Paper
                          shadow="sm"
                          radius="lg"
                          p="lg"
                          style={{
                            background: done
                              ? "var(--secondary-color)"
                              : "var(--primary-color)",
                            color: "white",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: 160,
                          }}
                        >
                          <div>
                            <Text fw={700} size="sm" lineClamp={2}>
                              {course.title}
                            </Text>
                            <Text size="xs" c="white" opacity={0.8}>
                              {course.totalModules} modul
                            </Text>
                          </div>

                          <div>
                            <Group justify="space-between" mb={6}>
                              <Text size="xs" fw={600}>
                                {Math.round(course.progress)}%
                              </Text>
                            </Group>
                            <MantineProgress
                              value={course.progress}
                              size="sm"
                              radius="xl"
                              color="white"
                              style={{ background: "rgba(255,255,255,0.3)" }}
                            />
                          </div>

                          <Button
                            fullWidth
                            size="xs"
                            radius="xl"
                            component={Link}
                            href={`/user/courses/${course.id}`}
                            style={{
                              marginTop: 12,
                              background: "white",
                              color: done
                                ? "var(--secondary-color)"
                                : "var(--primary-color)",
                              fontWeight: 600,
                            }}
                          >
                            {done ? "Review" : "Lanjutkan"}
                          </Button>
                        </Paper>
                      </Grid.Col>
                    );
                  })}

                  {!loading && (data?.courses || []).length === 0 && (
                    <Grid.Col span={12}>
                      <Text c="dimmed" size="sm">
                        Belum ada kursus yang diikuti.
                      </Text>
                    </Grid.Col>
                  )}
                  {loading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
                        <Skeleton height={160} radius="lg" />
                      </Grid.Col>
                    ))}
                </Grid>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card padding="lg" radius="md" style={{ height: "100%" }}>
              <Group justify="space-between" mb={4} align="center">
                <Group gap={6}>
                  <IconCalendarPlus size={18} />
                  <Title order={4}>Jadwal Belajar</Title>
                </Group>
                <Group gap={4}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() =>
                      setCalendarMonth((m) => m.subtract(1, "month"))
                    }
                    aria-label="prev"
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                  <Text size="sm" fw={600}>
                    {calendarMonth.format("MMMM YYYY")}
                  </Text>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => setCalendarMonth((m) => m.add(1, "month"))}
                    aria-label="next"
                  >
                    <IconChevronRight size={16} />
                  </ActionIcon>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setAddOpen(true)}
                  >
                    Tambah
                  </Button>
                </Group>
              </Group>
              <Divider my={8} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  gap: 4,
                  fontSize: 11,
                }}
              >
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
                  <div key={d} style={{ textAlign: "center", fontWeight: 600 }}>
                    {d}
                  </div>
                ))}
                {calendarCells.map((cell, i) => {
                  const dateStr = cell.date
                    ? cell.date.format("YYYY-MM-DD")
                    : "";
                  const evs = dateStr ? eventsByDay[dateStr] || [] : [];
                  return (
                    <div
                      key={i}
                      style={{
                        minHeight: 20,
                        border: "1px solid var(--border-color,#e3e6ea)",
                        borderRadius: 6,
                        padding: 4,
                        display: "flex",
                        flexDirection: "column",
                        background:
                          cell.date && cell.date.isSame(dayjs(), "day")
                            ? "rgba(30,55,105,0.08)"
                            : "#fff",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        {cell.date ? cell.date.date() : ""}
                      </div>
                      <ScrollArea style={{ flex: 1 }} type="never">
                        <Stack gap={2}>
                          {evs.map((ev) => (
                            <Badge
                              key={ev.id}
                              size="xs"
                              radius="sm"
                              color={categoryColor[ev.category]}
                              variant="filled"
                              style={{ cursor: "pointer" }}
                              title={ev.title}
                              onClick={() => confirmDelete(ev.id)}
                            >
                              {ev.title}
                            </Badge>
                          ))}
                        </Stack>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Grid.Col>
        </Grid>
        {/* Row 2 */}
        <Grid gutter="xl" mt="md">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card padding="lg" radius="md" style={{ height: "100%" }}>
              <Group justify="space-between" mb="xs">
                <Title order={3}>Transaksi Terbaru</Title>
                <Button
                  variant="light"
                  size="xs"
                  component={Link}
                  href="/user/transactions"
                >
                  Lihat Selengkapnya
                </Button>
              </Group>
              <Divider my={8} />
              <Stack gap="sm">
                {(data?.transactions || []).map((t) => (
                  <Group key={t.id} justify="space-between" align="flex-start">
                    <Group gap={6} align="flex-start">
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
                  <Text c="dimmed" size="sm">
                    Belum ada transaksi.
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card padding="lg" radius="md" style={{ height: "100%" }}>
              <Group justify="space-between" mb="xs">
                <Title order={3}>Diskusi Terbaru</Title>
                <Button
                  variant="light"
                  size="xs"
                  component={Link}
                  href="/user/discussions"
                >
                  Lihat Selengkapnya
                </Button>
              </Group>
              <Divider my={8} />
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
                  <Text c="dimmed" size="sm">
                    Belum ada diskusi terbaru.
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
      <Modal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        title="Tambah Jadwal"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Judul"
            placeholder="Belajar Scratch"
            value={evTitle}
            onChange={(e) => setEvTitle(e.currentTarget.value)}
            required
          />
          <Select
            label="Kategori"
            data={[
              { value: "belajar", label: "Belajar" },
              { value: "tugas", label: "Tugas" },
              { value: "live", label: "Live Calls" },
            ]}
            value={evCategory}
            onChange={(v) => setEvCategory(v as ScheduleEvent["category"])}
          />
          <Textarea
            label="Deskripsi"
            minRows={2}
            value={evDesc}
            onChange={(e) => setEvDesc(e.currentTarget.value)}
            placeholder="Catatan tambahan"
          />
          <Group grow>
            <TextInput
              type="date"
              label="Mulai"
              value={evStart}
              onChange={(e) => setEvStart(e.currentTarget.value)}
            />
            <TextInput
              type="date"
              label="Selesai (opsional)"
              value={evEnd}
              onChange={(e) => setEvEnd(e.currentTarget.value)}
            />
          </Group>
          <Button onClick={addEvent} disabled={!evTitle}>
            Simpan
          </Button>
          <Text size="xs" c="dimmed">
            Rentang tanggal akan menghasilkan event berulang harian di kalender
            (setiap hari dalam rentang). Klik dua kali badge di kalender untuk
            menghapus.
          </Text>
        </Stack>
      </Modal>
      <Modal
        opened={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hapus Jadwal"
        centered
      >
        <Stack>
          <Text size="sm">
            Yakin ingin menghapus jadwal ini? Tindakan ini tidak bisa
            dibatalkan.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteId(null)}
              size="xs"
            >
              Batal
            </Button>
            <Button color="red" onClick={doDelete} size="xs">
              Hapus
            </Button>
          </Group>
        </Stack>
      </Modal>
      {eventsError && (
        <Alert color="red" mt="md" icon={<IconAlertCircle size={16} />}>
          {eventsError}
        </Alert>
      )}
    </Container>
  );
}
