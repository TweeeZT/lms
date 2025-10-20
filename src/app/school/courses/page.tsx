"use client";

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
  SimpleGrid,
  Skeleton,
  Pagination,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBook,
  IconPlayerPlayFilled,
  IconStar,
  IconTrophy,
  IconCertificate,
  IconDownload,
  IconAward,
  IconCoins,
  IconShield,
} from "@tabler/icons-react";
import {
  useState,
  useEffect,
  useMemo,
  type ReactNode,
  type ComponentType,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../../hooks/useAuth";
import PrimeLoader from "../../../components/PrimeLoader";

type ApiCourse = {
  id: string;
  title: string;
  description: string;
  thumbnail?: string | null;
  category: "scratch" | "roblox" | string;
  price?: number | null;
  durationMin?: number | null;
  level: "beginner" | "intermediate" | "advanced" | string;
  totalModules: number;
  enrolledCount?: number | null;
  rating?: number | null;
  instructor?: { id: string; fullName: string; avatar?: string | null } | null;
  points?: number | null; // new: points from courses.points
};

type ApiEnrollmentItem = {
  enrollmentId: string;
  enrolledAt: string;
  course: ApiCourse | null;
  progress: {
    percentage: number;
    completedCount: number;
    currentModuleId: string | null;
  };
};

export default function UserCoursesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApiEnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [studentStats, setStudentStats] = useState<{
    points: number;
    coins: number;
    tier: string;
  }>({ points: 0, coins: 0, tier: "Newbie" });
  const limit = 6;

  // Reusable StatCard (vertical) similar style to admin
  function StatCard({
    label,
    value,
    Icon,
  }: {
    label: string;
    value: ReactNode;
    Icon: ComponentType<{ size?: number; color?: string }>;
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

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch school enrollments from school_progress
        const res = await fetch(
          `/api/school/my-courses?schoolUserId=${user.id}&page=1&limit=100`
        );
        const json = await res.json();
        if (res.ok && json.success) {
          const rows = (json.items as ApiEnrollmentItem[]).filter(
            (r) => !!r.course
          );
          setItems(rows);
        }

        // Fetch student stats (points, coins, tier)
        const statsRes = await fetch(`/api/user/stats?userId=${user.id}`);
        const statsJson = await statsRes.json();
        if (statsRes.ok && statsJson.success) {
          setStudentStats({
            points: statsJson.points || 0,
            coins: statsJson.coins || 0,
            tier: statsJson.tier || "Newbie",
          });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const stats = useMemo(() => {
    const total = items.length; // Total kursus aktif (semua)
    const totalPoints = studentStats.points; // Dari students.points
    const totalCoins = studentStats.coins; // Dari students.coins
    const tier = studentStats.tier; // Dari students atau level mapping
    return { total, totalPoints, totalCoins, tier };
  }, [items, studentStats]);

  // Pagination
  const totalPages = Math.ceil(items.length / limit);
  const paginatedItems = items.slice((page - 1) * limit, page * limit);

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

  return (
    <Container size="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            Kursus Saya
          </Title>
          <Text size="lg" c="dimmed">
            Pantau progress belajar dan lanjutkan kursus yang sedang Anda ikuti
          </Text>
        </div>

        {/* Progress Overview */}
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard
              label="Kursus Aktif"
              value={stats.total}
              Icon={IconBook}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard label="Tier" value={stats.tier} Icon={IconShield} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard
              label="Total Points"
              value={stats.totalPoints}
              Icon={IconAward}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard
              label="Total Coins"
              value={stats.totalCoins}
              Icon={IconCoins}
            />
          </Grid.Col>
        </Grid>

        {/* Course List */}
        {loading && items.length === 0 ? (
          <PrimeLoader />
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              {paginatedItems.map((row) => {
                const course = row.course!;
                const totalModules = course.totalModules || 0;
                const completedCount = Math.max(
                  0,
                  Math.min(totalModules, row.progress.completedCount || 0)
                );
                const isCompleted = totalModules > 0 && completedCount === totalModules;
                const progress = totalModules > 0
                  ? Math.round((completedCount / totalModules) * 100)
                  : 0;
                const currentModule = completedCount;

                return (
                  <Card
                    key={row.enrollmentId}
                    radius="lg"
                    padding={0}
                    className="card-hover"
                    style={{ overflow: "hidden" }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 180,
                        background: "#f0f0f0",
                      }}
                    >
                      {course.thumbnail ? (
                        <Image
                          src={course.thumbnail}
                          alt={course.title}
                          fill
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "var(--gradient-primary)",
                          }}
                        >
                          <IconBook size={48} color="#fff" />
                        </div>
                      )}
                      {/* Badge overlay */}
                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          zIndex: 1,
                        }}
                      >
                        <Badge
                          variant="filled"
                          color={isCompleted ? "green" : "blue"}
                        >
                          {isCompleted ? "Selesai" : "Berlangsung"}
                        </Badge>
                      </div>
                      {isCompleted && (
                        <div
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            zIndex: 1,
                          }}
                        >
                          <Badge
                            variant="filled"
                            color="yellow"
                            leftSection={<IconTrophy size="0.8rem" />}
                          >
                            Sertifikat
                          </Badge>
                        </div>
                      )}
                    </div>

                    <Stack gap="md" p="lg">
                      <div>
                        <Title order={4} mb="xs" lineClamp={2}>
                          {course.title}
                        </Title>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "var(--mantine-color-dimmed)",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: course.description || "",
                          }}
                        />
                      </div>

                      <Group gap="xs">
                        <IconStar size="1rem" color="gold" />
                        <Text size="sm">{course.rating ?? 0}</Text>
                        <Text size="sm" c="dimmed">
                          •
                        </Text>
                        <Text size="sm" c="dimmed">
                          {course.instructor?.fullName || "-"}
                        </Text>
                      </Group>

                      <div>
                        <Group justify="space-between" mb="xs">
                          <Text size="sm">
                            Progress ({currentModule}/{course.totalModules}{" "}
                            modul)
                          </Text>
                          <Text size="sm" fw={600}>
                            {progress}%
                          </Text>
                        </Group>
                        <Progress
                          value={progress}
                          color={isCompleted ? "green" : "blue"}
                        />
                      </div>

                      <Group justify="space-between">
                        <Group gap="xs">
                          <IconAward size="1rem" />
                          <Text size="sm">
                            {course.points != null
                              ? course.points
                              : Math.round(
                                  ((course.durationMin || 0) / 60) * 80
                                )}{" "}
                            Points
                          </Text>
                        </Group>

                        <Group gap="xs">
                          {isCompleted && (
                            <Button
                              variant="light"
                              size="sm"
                              leftSection={<IconDownload size="0.8rem" />}
                              color="yellow"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    `/api/user/certificates?userId=${user?.id}&courseId=${course.id}&sendEmail=true`
                                  );
                                  const json = await res.json();
                                  if (!res.ok || !json.success) {
                                    notifications.show({
                                      title: "Error",
                                      message: "Gagal mengunduh sertifikat",
                                      color: "red",
                                    });
                                    return;
                                  }
                                  const url =
                                    json.certificate?.url ||
                                    json.certificateUrl ||
                                    (Array.isArray(json.items) &&
                                    json.items.length > 0
                                      ? json.items[0].certificate_url ||
                                        json.items[0].url
                                      : null);
                                  if (url) {
                                    window.open(url, "_blank");
                                    notifications.show({
                                      title: "Sertifikat Diunduh",
                                      message:
                                        "Sertifikat telah diunduh dan dikirim ke email Anda!",
                                      color: "green",
                                    });
                                  }
                                } catch (error) {
                                  console.error(
                                    "Error downloading certificate:",
                                    error
                                  );
                                  notifications.show({
                                    title: "Error",
                                    message:
                                      "Terjadi kesalahan saat mengunduh sertifikat",
                                    color: "red",
                                  });
                                }
                              }}
                            >
                              Sertifikat
                            </Button>
                          )}
                          <Button
                            className="btn-primary"
                            size="sm"
                            component={Link}
                            href={`/school/courses/${course.id}`}
                            leftSection={<IconPlayerPlayFilled size="0.8rem" />}
                          >
                            {isCompleted ? "Resume Materi" : "Lanjutkan"}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination
                  total={totalPages}
                  value={page}
                  onChange={setPage}
                  color="blue"
                />
              </Group>
            )}
          </>
        )}

        {/* Completed Courses with Certificates */}
        <Card padding="lg" radius="md">
          <Title order={3} mb="md">
            Sertifikat yang Diperoleh
          </Title>
          {items.filter((i) => i.progress.percentage >= 100).length === 0 ? (
            <Text size="sm" c="dimmed">
              Belum ada sertifikat yang diperoleh.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {items
                .filter((i) => i.progress.percentage >= 100)
                .map((i) => (
                  <Card
                    key={i.enrollmentId}
                    p="md"
                    radius="sm"
                    withBorder
                    className="card-hover"
                  >
                    <Stack align="center" gap="sm">
                      <IconCertificate size="3rem" color="gold" />
                      <div style={{ textAlign: "center" }}>
                        <Text fw={600} size="sm">
                          {i.course?.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Diperoleh{" "}
                          {new Date(i.enrolledAt).toLocaleDateString()}
                        </Text>
                      </div>
                      <Button
                        size="xs"
                        variant="light"
                        color="yellow"
                        leftSection={<IconDownload size="0.8rem" />}
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `/api/user/certificates?userId=${user?.id}&courseId=${i.course?.id}`
                            );
                            const json = await res.json();
                            if (!res.ok || !json.success) return;
                            const url =
                              json.certificate?.url ||
                              json.certificateUrl ||
                              (Array.isArray(json.items) &&
                              json.items.length > 0
                                ? json.items[0].certificate_url ||
                                  json.items[0].url
                                : null);
                            if (url) {
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `sertifikat-${i.course?.title?.replace(
                                /\s+/g,
                                "-"
                              )}.pdf`;
                              link.click();
                            }
                          } catch (error) {
                            console.error(
                              "Error downloading certificate:",
                              error
                            );
                          }
                        }}
                      >
                        Download
                      </Button>
                    </Stack>
                  </Card>
                ))}
            </SimpleGrid>
          )}
        </Card>

        {!loading && items.length === 0 && (
          <Card padding="xl" radius="md">
            <Stack align="center" gap="md">
              <IconBook size="3rem" color="gray" />
              <Text size="lg" c="dimmed">
                Belum ada kursus yang diikuti
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Mulai perjalanan belajar Anda dengan memilih kursus yang menarik
              </Text>
              <Button
                className="btn-primary"
                component={Link}
                href="/user/explore"
              >
                Jelajahi Kursus
              </Button>
            </Stack>
          </Card>
        )}
      </Stack>

      {/* Detail materi kini dibuka di halaman baru: /user/courses/[id] */}
    </Container>
  );
}
