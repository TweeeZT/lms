"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/id";

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
  Divider,
  Paper,
  Progress as MantineProgress,
  Box,
} from "@mantine/core";
import { DatesProvider, DateInput, Calendar } from "@mantine/dates";
import {
  IconAlertCircle,
  IconBook,
  IconReceipt2,
  IconSum,
  IconAward,
  IconCalendarPlus,
  IconChevronLeft,
  IconChevronRight,
  IconListDetails,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

// Set locale and weekday labels
dayjs.locale("id");
const weekdayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

function StatCard({ label, value, Icon }: StatCardProps) {
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
          enrollmentsCount?: number;
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
          // Prefer server-reported enrollmentsCount when available; otherwise fall back to inProgress+completed
          if (
            typeof d.enrollmentsCount === "number" &&
            d.enrollmentsCount >= 0
          ) {
            json.stats.activeCourses = d.enrollmentsCount;
          } else if (
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
        // Fallback A: if coins & points still zero while we have user, fetch lightweight stats endpoint
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

        // Fallback B: Ensure activeCourses and course cards reflect actual enrollments
        if (
          user?.id &&
          json?.stats &&
          ((json.stats.activeCourses ?? 0) === 0 ||
            (json.courses?.length ?? 0) === 0)
        ) {
          try {
            const cRes = await fetch(
              `/api/user/courses?userId=${user.id}&page=1&limit=50`,
              { cache: "no-store" }
            );
            const cJson = await cRes.json();
            if (cRes.ok && cJson.success) {
              const items = Array.isArray(cJson.items) ? cJson.items : [];
              const total =
                typeof cJson.total === "number" ? cJson.total : items.length;
              const mapped = items.map((row: any) => {
                const course = row.course || {};
                const totalModules = Number(course.totalModules || 0);
                const pct = Number(row.progress?.percentage || 0);
                return {
                  id: String(course.id || row.enrollmentId || Math.random()),
                  title: String(course.title || ""),
                  totalModules,
                  progress: Math.max(0, Math.min(100, Math.round(pct))),
                };
              });
              setData((prev) => {
                if (!prev) return prev;
                const nextStats = prev.stats
                  ? {
                      ...prev.stats,
                      activeCourses:
                        (prev.stats.activeCourses ?? 0) === 0
                          ? total
                          : prev.stats.activeCourses,
                    }
                  : {
                      activeCourses: total,
                      xp: 0,
                      points: 0,
                      coins: 0,
                      completed: 0,
                      tier: "newbie",
                    };
                const nextCourses =
                  (prev.courses?.length ?? 0) === 0 && mapped.length > 0
                    ? mapped
                    : prev.courses;
                return { ...prev, stats: nextStats, courses: nextCourses };
              });
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
      // Hanya masukkan event jika tanggalnya ada di bulan yang sedang dilihat
      if (d.isSame(calendarMonth, "month")) {
        const k = d.format("YYYY-MM-DD");
        (eventsByDay[k] = eventsByDay[k] || []).push(ev);
      }
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
    if (!user?.id) return null;
    try {
      setEventsError(null);
      const res = await fetch(`/api/user/schedule-events?userId=${user.id}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal memuat jadwal");
      // Mapping agar field start diisi dari startDate (API),
      // dan end diisi dari endDate (atau end, atau fallback ke start jika null)
      const mapped = (json.events || []).map((ev: any) => ({
        ...ev,
        start: ev.startDate || ev.start,
        end: ev.endDate || ev.end || ev.start,
      }));
      setScheduleEvents(mapped);
      return mapped;
    } catch (e: unknown) {
      setEventsError(e instanceof Error ? e.message : "Gagal memuat jadwal");
      return null;
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
      // Setelah tambah, langsung refresh data jadwal dari server
      await fetchEvents();
      setAddOpen(false);
      resetForm();
    } catch (e: unknown) {
      setEventsError(e instanceof Error ? e.message : "Gagal menambah jadwal");
    }
  };

  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<ScheduleEvent[]>(
    []
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] =
    useState<ScheduleEvent["category"]>("belajar");
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Saat tombol Edit ditekan, isi form edit dengan data event terpilih
  const openEditModal = () => {
    if (!selectedEvent) return;
    setEditTitle(selectedEvent.title);
    setEditCategory(selectedEvent.category);
    setEditDesc(selectedEvent.description || "");
    setEditStart(dayjs(selectedEvent.start).format("YYYY-MM-DD"));
    setEditEnd(
      selectedEvent.end ? dayjs(selectedEvent.end).format("YYYY-MM-DD") : ""
    );
    setEditOpen(true);
  };
  const closeEditModal = () => {
    setEditOpen(false);
  };
  const handleEditSubmit = async () => {
    if (!selectedEvent || !user?.id || !editTitle) return;
    try {
      const body = {
        userId: user.id,
        title: editTitle.trim(),
        category: editCategory,
        description: editDesc.trim() || null,
        startDate: editStart,
        endDate: editEnd || null,
      };
      const res = await fetch(`/api/user/schedule-events/${selectedEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal update jadwal");
      setEditOpen(false);
      // Fetch ulang data jadwal agar selalu up-to-date
      const mapped = await fetchEvents();
      if (mapped && selectedEvent) {
        const updated = mapped.find(
          (ev: ScheduleEvent) => ev.id === selectedEvent.id
        );
        if (updated) setSelectedEvent(updated);
      }
    } catch (e) {
      // error tetap tidak ditampilkan sebagai notif
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
      setSelectedEvent(null);
    } catch (e: unknown) {
      setEventsError(e instanceof Error ? e.message : "Gagal menghapus jadwal");
    }
  };

  return (
    <DatesProvider
      settings={{ locale: "id", firstDayOfWeek: 0, weekendDays: [0] }}
    >
      <Container size="xl">
        <Stack gap="xl">
          <div>
            {loading ? (
              <>
                <Skeleton height={36} width={250} mb="md" />
                <Skeleton height={24} width={350} />
              </>
            ) : (
              <>
                <Title order={1} mb="md">
                  Dashboard Belajar
                </Title>
                <Text size="lg" c="dimmed">
                  {data?.user?.fullName
                    ? `Selamat datang kembali, ${data.user.fullName}!`
                    : ""}
                </Text>
              </>
            )}
          </div>
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}
          <Grid gutter="xl">
            {loading
              ? // Skeleton untuk 4 stat cards
                Array.from({ length: 4 }).map((_, idx) => (
                  <Grid.Col key={idx} span={{ base: 12, md: 6, lg: 3 }}>
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
                        minHeight: 170,
                      }}
                    >
                      <Skeleton height={12} width={100} mb="sm" />
                      <Skeleton height={56} width={56} circle mb="md" />
                      <Skeleton height={32} width={80} />
                    </Card>
                  </Grid.Col>
                ))
              : [
                  {
                    label: "Kursus Aktif",
                    value: String(stats?.activeCourses || 0),
                    Icon: IconBook,
                  },
                  {
                    label: "Total Koin",
                    value: String(stats?.coins || 0),
                    Icon: IconReceipt2,
                  },
                  {
                    label: "Poin",
                    value: String(stats?.points || 0),
                    Icon: IconSum,
                  },
                  {
                    label: "Tier",
                    value: String(stats?.tier || "newbie").toUpperCase(),
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
                  {loading ? (
                    <>
                      <Group justify="space-between">
                        <div>
                          <Skeleton height={24} width={150} mb="xs" />
                          <Skeleton height={16} width={220} />
                        </div>
                        <Skeleton height={30} width={150} />
                      </Group>
                    </>
                  ) : (
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
                  )}

                  <Grid gutter="md">
                    {(() => {
                      const courses = data?.courses || [];
                      const total = courses.length;
                      const MAX_SHOW_WITHOUT_PLACEHOLDER = 6;
                      const MAX_SHOW_WITH_PLACEHOLDER = 5;
                      const shouldUsePlaceholder =
                        total > MAX_SHOW_WITHOUT_PLACEHOLDER;
                      const visibleCourses = shouldUsePlaceholder
                        ? courses.slice(0, MAX_SHOW_WITH_PLACEHOLDER)
                        : courses.slice(0, MAX_SHOW_WITHOUT_PLACEHOLDER);

                      return (
                        <>
                          {visibleCourses.map((course) => {
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
                                      style={{
                                        background: "rgba(255,255,255,0.3)",
                                      }}
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

                          {shouldUsePlaceholder && (
                            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                              <Paper
                                withBorder
                                radius="lg"
                                p="lg"
                                style={{
                                  minHeight: 160,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  background: "var(--mantine-color-gray-0)",
                                }}
                                component={Link}
                                href="/user/courses"
                              >
                                <div style={{ textAlign: "center" }}>
                                  <Title order={2}>
                                    +
                                    {Math.max(
                                      0,
                                      total - MAX_SHOW_WITH_PLACEHOLDER
                                    )}
                                  </Title>
                                  <Text size="xs" c="dimmed">
                                    Lihat kursus lainnya
                                  </Text>
                                </div>
                              </Paper>
                            </Grid.Col>
                          )}
                        </>
                      );
                    })()}

                    {!loading && (data?.courses || []).length === 0 && (
                      <Grid.Col span={12}>
                        <Text c="dimmed" size="sm">
                          Belum ada kursus yang diikuti.
                        </Text>
                      </Grid.Col>
                    )}
                    {loading &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
                          <Skeleton height={160} radius="lg" />
                        </Grid.Col>
                      ))}
                  </Grid>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Card p={0} radius="md" style={{ height: "100%" }}>
                {loading ? (
                  <Stack gap="md" p="md">
                    <Skeleton height={200} />
                    <Skeleton height={300} />
                  </Stack>
                ) : (
                  <>
                    <Stack gap={0}>
                      <Box
                        px="md"
                        py="xs"
                        style={{
                          borderBottom: "1px solid var(--mantine-color-gray-2)",
                        }}
                      >
                        <Group justify="space-between" align="center">
                          <Group gap={6} align="center">
                            <IconCalendarPlus
                              size={16}
                              style={{ color: "var(--mantine-color-blue-6)" }}
                            />
                            <Text fw={600} size="sm">
                              Jadwal Belajar
                            </Text>
                          </Group>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="blue"
                            leftSection={<IconCalendarPlus size={14} />}
                            onClick={() => setAddOpen(true)}
                            px="xs"
                          >
                            Tambah
                          </Button>
                        </Group>
                      </Box>
                      <Box
                        px="md"
                        py="xs"
                        style={{
                          borderBottom: "1px solid var(--mantine-color-gray-2)",
                          backgroundColor: "var(--mantine-color-gray-0)",
                        }}
                      >
                        <Group justify="center" align="center">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() =>
                              setCalendarMonth((m) => m.subtract(1, "month"))
                            }
                          >
                            <IconChevronLeft size={16} />
                          </ActionIcon>
                          <Text
                            size="sm"
                            fw={500}
                            style={{ width: "80px", textAlign: "center" }}
                          >
                            {calendarMonth.locale("id").format("MMM YYYY")}
                          </Text>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() =>
                              setCalendarMonth((m) => m.add(1, "month"))
                            }
                          >
                            <IconChevronRight size={16} />
                          </ActionIcon>
                        </Group>
                      </Box>
                    </Stack>
                    <Divider />
                    <Box p="md">
                      <Calendar
                        defaultDate={calendarMonth.toDate()}
                        onDateChange={(date) => setCalendarMonth(dayjs(date))}
                        getDayProps={(date) => ({
                          style: { height: "32px" },
                        })}
                        size="xs"
                        firstDayOfWeek={1}
                        renderDay={(date) => {
                          const d = dayjs(date);
                          const dateStr = d.format("YYYY-MM-DD");
                          const evs = eventsByDay[dateStr] || [];
                          const isToday = d.isSame(dayjs(), "day");

                          return (
                            <Box
                              p={0}
                              style={{
                                cursor: evs.length > 0 ? "pointer" : "default",
                                height: "32px",
                                backgroundColor: isToday
                                  ? "var(--mantine-color-blue-0)"
                                  : undefined,
                                transition: "background-color 0.2s",
                                "&:hover":
                                  evs.length > 0
                                    ? {
                                        backgroundColor:
                                          "var(--mantine-color-gray-0)",
                                      }
                                    : undefined,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() => {
                                if (evs.length > 0) {
                                  setSelectedDate(d.toDate());
                                  setSelectedDateEvents(evs);
                                }
                              }}
                            >
                              <Stack
                                gap={2}
                                align="center"
                                justify="center"
                                style={{ height: "100%", padding: "4px 0" }}
                              >
                                <Text
                                  size="xs"
                                  fw={500}
                                  style={{
                                    color: isToday
                                      ? "var(--mantine-color-blue-7)"
                                      : undefined,
                                  }}
                                >
                                  {d.date()}
                                </Text>
                                {evs.length > 0 && (
                                  <Group gap={3} justify="center">
                                    {Object.entries(
                                      evs.reduce(
                                        (
                                          acc: Record<string, number>,
                                          ev: ScheduleEvent
                                        ) => {
                                          acc[ev.category] =
                                            (acc[ev.category] || 0) + 1;
                                          return acc;
                                        },
                                        {} as Record<string, number>
                                      )
                                    )
                                      .slice(0, 3)
                                      .map(
                                        ([category, count]: [
                                          string,
                                          number
                                        ]) => (
                                          <Box
                                            key={category}
                                            style={{
                                              width: 5,
                                              height: 5,
                                              borderRadius: "50%",
                                              backgroundColor: `var(--mantine-color-${
                                                categoryColor[
                                                  category as ScheduleEvent["category"]
                                                ]
                                              }-6)`,
                                              boxShadow:
                                                "0 1px 2px rgba(0,0,0,0.1)",
                                            }}
                                            title={`${count} jadwal ${category}`}
                                          />
                                        )
                                      )}
                                  </Group>
                                )}
                              </Stack>
                            </Box>
                          );
                        }}
                        weekdayFormat={(date) =>
                          weekdayLabels[new Date(date).getDay()]
                        }
                        styles={(theme) => ({
                          weekday: {
                            fontSize: 11,
                            padding: "8px 0",
                            fontWeight: 600,
                            color: theme.colors.gray[6],
                            textAlign: "center",
                            backgroundColor: theme.colors.gray[0],
                            borderBottom: `1px solid ${theme.colors.gray[2]}`,
                          },
                          monthCell: {
                            border: `1px solid ${theme.colors.gray[2]}`,
                            borderRadius: 0,
                            padding: 0,
                            maxWidth: "100%",
                          },
                          calendarHeader: {
                            display: "none",
                          },
                          monthThead: {
                            marginTop: 0,
                          },
                          cell: {
                            padding: 0,
                            borderRadius: 0,
                            minHeight: "32px !important",
                            height: "32px !important",
                            "&[data-weekend]": {
                              color: theme.colors.red[6],
                            },
                            "&[data-outside]": {
                              color: theme.colors.gray[5],
                            },
                          },
                          month: {
                            borderRadius: 0,
                            backgroundColor: "white",
                            width: "100%",
                          },
                        })}
                        classNames={{
                          day: "mantine-calendar-day-cell",
                        }}
                      />
                      <style>{`
                  .mantine-calendar-day-cell {
                    min-height: 60px;
                    padding: 0;
                  }
                  .mantine-Calendar-root {
                    width: 100%;
                  }
                  .mantine-Calendar-weekday {
                    font-size: 11px;
                    padding: 6px 0;
                    font-weight: 600;
                    color: var(--mantine-color-gray-6);
                    background-color: var(--mantine-color-gray-0);
                    border-bottom: 1px solid var(--mantine-color-gray-2);
                  }
                  .mantine-Calendar-month {
                    border: 1px solid var(--mantine-color-gray-2);
                  }
                  .mantine-Calendar-day[data-weekend] {
                    color: var(--mantine-color-red-6);
                  }
                  .mantine-Calendar-day[data-outside] {
                    color: var(--mantine-color-gray-5);
                  }
                  .mantine-Calendar-day[data-selected] {
                    background-color: var(--mantine-color-blue-0);
                  }
                `}</style>
                    </Box>
                  </>
                )}
              </Card>
            </Grid.Col>
          </Grid>
          {/* Row 2 */}
          <Grid gutter="xl" mt="md">
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <Card padding="lg" radius="md" style={{ height: "100%" }}>
                {loading ? (
                  <>
                    <Group justify="space-between" mb="xs">
                      <Skeleton height={24} width={180} />
                      <Skeleton height={30} width={150} />
                    </Group>
                    <Divider my={8} />
                  </>
                ) : (
                  <>
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
                  </>
                )}
                {loading ? (
                  <Stack gap="sm">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Group key={i} justify="space-between">
                        <Group gap={6}>
                          <Skeleton height={16} width={16} circle />
                          <Stack gap={4}>
                            <Skeleton height={14} width={180} />
                            <Skeleton height={12} width={120} />
                          </Stack>
                        </Group>
                        <Skeleton height={14} width={80} />
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <Stack gap="sm">
                    {(data?.transactions || []).map((t) => (
                      <Group
                        key={t.id}
                        justify="space-between"
                        align="flex-start"
                      >
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
                )}
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <Card padding="lg" radius="md" style={{ height: "100%" }}>
                {loading ? (
                  <>
                    <Group justify="space-between" mb="xs">
                      <Skeleton height={24} width={180} />
                      <Skeleton height={30} width={150} />
                    </Group>
                    <Divider my={8} />
                  </>
                ) : (
                  <>
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
                  </>
                )}
                {loading ? (
                  <Stack gap="sm">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Stack key={i} gap={4}>
                        <Skeleton height={14} width="80%" />
                        <Skeleton height={12} width="100%" />
                      </Stack>
                    ))}
                  </Stack>
                ) : (
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
                )}
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
              <DateInput
                label="Mulai"
                value={evStart ? new Date(evStart) : null}
                onChange={(date) =>
                  setEvStart(date ? dayjs(date).format("YYYY-MM-DD") : "")
                }
                placeholder="Pilih tanggal mulai"
                clearable
                weekdayFormat="ddd"
                firstDayOfWeek={1}
                locale="id"
                valueFormat="DD MMMM, YYYY"
                styles={(theme) => ({
                  weekday: {
                    fontSize: "0.875rem",
                  },
                })}
              />
              <DateInput
                label="Selesai (opsional)"
                value={evEnd ? new Date(evEnd) : null}
                onChange={(date) =>
                  setEvEnd(date ? dayjs(date).format("YYYY-MM-DD") : "")
                }
                placeholder="Pilih tanggal selesai"
                clearable
                minDate={evStart ? new Date(evStart) : undefined}
                weekdayFormat="ddd"
                firstDayOfWeek={1}
                locale="id"
                valueFormat="DD MMMM, YYYY"
                styles={(theme) => ({
                  weekday: {
                    fontSize: "0.875rem",
                  },
                })}
              />
            </Group>
            <Button onClick={addEvent} disabled={!evTitle}>
              Simpan
            </Button>
            <Text size="xs" c="dimmed">
              Rentang tanggal akan menghasilkan event berulang harian di
              kalender (setiap hari dalam rentang). Klik badge untuk detail, dan
              hapus dari modal detail.
            </Text>
          </Stack>
        </Modal>

        <Modal
          opened={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent ? `Detail Jadwal: ${selectedEvent.title}` : ""}
          centered
        >
          {selectedEvent && (
            <Stack gap="sm">
              <Badge color={categoryColor[selectedEvent.category]}>
                {selectedEvent.category}
              </Badge>
              <Text fw={600}>{selectedEvent.title}</Text>
              <Text size="sm" c="dimmed">
                {selectedEvent.description || "-"}
              </Text>
              <Text size="sm">
                Mulai:{" "}
                {dayjs(selectedEvent.start).locale("id").format("DD MMMM YYYY")}
              </Text>
              {selectedEvent.end && (
                <Text size="sm">
                  Selesai:{" "}
                  {dayjs(selectedEvent.end).locale("id").format("DD MMMM YYYY")}
                </Text>
              )}
              <Group justify="flex-end" gap={8}>
                <Button size="xs" variant="default" onClick={openEditModal}>
                  Edit
                </Button>
                <Button
                  color="red"
                  size="xs"
                  onClick={() => confirmDelete(selectedEvent.id)}
                >
                  Hapus
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Modal Daftar Jadwal per Tanggal */}
        <Modal
          opened={!!selectedDate}
          onClose={() => {
            setSelectedDate(null);
            setSelectedDateEvents([]);
          }}
          title={
            selectedDate
              ? `Jadwal: ${dayjs(selectedDate)
                  .locale("id")
                  .format("DD MMMM YYYY")}`
              : ""
          }
          centered
          size="sm"
        >
          <Stack gap="md">
            {selectedDateEvents.length > 0 ? (
              selectedDateEvents.map((ev) => (
                <Paper key={ev.id} p="sm" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Badge
                        color={categoryColor[ev.category]}
                        variant="light"
                        size="sm"
                      >
                        {ev.category}
                      </Badge>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => {
                          setSelectedEvent(ev);
                          setSelectedDate(null);
                          setSelectedDateEvents([]);
                        }}
                      >
                        <IconListDetails size={16} />
                      </ActionIcon>
                    </Group>
                    <Text size="sm" fw={500}>
                      {ev.title}
                    </Text>
                    {ev.description && (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {ev.description}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ))
            ) : (
              <Text c="dimmed" size="sm" ta="center">
                Tidak ada jadwal pada tanggal ini
              </Text>
            )}
          </Stack>
        </Modal>

        {/* Modal Edit Jadwal */}
        <Modal
          opened={!!editOpen}
          onClose={closeEditModal}
          title={
            selectedEvent
              ? `Edit Jadwal: ${selectedEvent.title}`
              : "Edit Jadwal"
          }
          centered
        >
          {selectedEvent && (
            <Stack gap="sm">
              <TextInput
                label="Judul"
                value={editTitle}
                onChange={(e) => setEditTitle(e.currentTarget.value)}
                required
              />
              <Select
                label="Kategori"
                data={[
                  { value: "belajar", label: "Belajar" },
                  { value: "tugas", label: "Tugas" },
                  { value: "live", label: "Live Calls" },
                ]}
                value={editCategory}
                onChange={(v) =>
                  setEditCategory(v as ScheduleEvent["category"])
                }
              />
              <Textarea
                label="Deskripsi"
                minRows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.currentTarget.value)}
                placeholder="Catatan tambahan"
              />
              <Group grow>
                <DateInput
                  label="Mulai"
                  value={editStart ? new Date(editStart) : null}
                  onChange={(date) =>
                    setEditStart(date ? dayjs(date).format("YYYY-MM-DD") : "")
                  }
                  placeholder="Pilih tanggal mulai"
                  clearable
                  weekdayFormat="ddd"
                  firstDayOfWeek={1}
                  locale="id"
                  valueFormat="DD MMMM, YYYY"
                  styles={(theme) => ({
                    weekday: {
                      fontSize: "0.875rem",
                    },
                  })}
                />
                <DateInput
                  label="Selesai (opsional)"
                  value={editEnd ? new Date(editEnd) : null}
                  onChange={(date) =>
                    setEditEnd(date ? dayjs(date).format("YYYY-MM-DD") : "")
                  }
                  placeholder="Pilih tanggal selesai"
                  clearable
                  minDate={editStart ? new Date(editStart) : undefined}
                  weekdayFormat="ddd"
                  firstDayOfWeek={1}
                  locale="id"
                  valueFormat="DD MMMM, YYYY"
                  styles={(theme) => ({
                    weekday: {
                      fontSize: "0.875rem",
                    },
                  })}
                />
              </Group>
              <Group justify="flex-end">
                <Button onClick={handleEditSubmit} disabled={!editTitle}>
                  Simpan
                </Button>
                <Button variant="default" onClick={closeEditModal}>
                  Batal
                </Button>
              </Group>
            </Stack>
          )}
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
    </DatesProvider>
  );
}
