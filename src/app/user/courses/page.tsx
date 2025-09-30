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
} from "@mantine/core";
import {
  IconBook,
  IconPlayerPlayFilled,
  IconCheck,
  IconStar,
  IconTrophy,
  IconCertificate,
  IconDownload,
  IconAward,
} from "@tabler/icons-react";
import {
  useState,
  useEffect,
  useMemo,
  type ReactNode,
  type ComponentType,
} from "react";
import Link from "next/link";
import { useAuth } from "../../../hooks/useAuth";

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
  const [loading, setLoading] = useState(false);

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
        const res = await fetch(`/api/user/courses?userId=${user.id}`);
        const json = await res.json();
        if (res.ok && json.success) {
          const rows = (json.items as ApiEnrollmentItem[]).filter(
            (r) => !!r.course
          );
          setItems(rows);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.progress.percentage >= 100).length;
    const active = total - completed;
    const totalXP = items.reduce(
      (sum, i) => sum + Math.round(((i.course?.durationMin || 0) / 60) * 80),
      0
    );
    const achievements = completed; // simple proxy
    return { total, completed, active, totalXP, achievements };
  }, [items]);

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
              value={stats.active}
              Icon={IconBook}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard
              label="Selesai"
              value={stats.completed}
              Icon={IconCheck}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard label="Total XP" value={stats.totalXP} Icon={IconAward} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <StatCard
              label="Pencapaian"
              value={stats.achievements}
              Icon={IconTrophy}
            />
          </Grid.Col>
        </Grid>

        {/* Course List */}
        {loading && items.length === 0 ? (
          <Stack gap="md">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={170} radius="md" />
            ))}
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            {items.map((row) => {
              const course = row.course!;
              const progress = Math.max(
                0,
                Math.min(100, row.progress.percentage || 0)
              );
              const isCompleted = progress >= 100;
              const currentModule = isCompleted
                ? course.totalModules
                : Math.max(
                    0,
                    Math.min(
                      course.totalModules,
                      Math.round((progress / 100) * course.totalModules)
                    )
                  );

              return (
                <Card
                  key={row.enrollmentId}
                  radius="lg"
                  padding="lg"
                  className="card-hover"
                >
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group>
                        <Badge
                          variant="light"
                          color={isCompleted ? "green" : "blue"}
                        >
                          {isCompleted ? "Selesai" : "Berlangsung"}
                        </Badge>
                      </Group>

                      {isCompleted && (
                        <Badge
                          variant="light"
                          color="yellow"
                          leftSection={<IconTrophy size="0.8rem" />}
                        >
                          Sertifikat
                        </Badge>
                      )}
                    </Group>

                    <div>
                      <Title order={4} mb="xs" lineClamp={2}>
                        {course.title}
                      </Title>
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {course.description}
                      </Text>
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
                          Progress ({currentModule}/{course.totalModules} modul)
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
                          {Math.round(((course.durationMin || 0) / 60) * 80)} XP
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
                                  `/api/user/certificates?userId=${user?.id}&courseId=${course.id}`
                                );
                                const json = await res.json();
                                if (
                                  res.ok &&
                                  json.success &&
                                  json.items.length > 0
                                ) {
                                  const cert = json.items[0];
                                  if (cert.certificate_url) {
                                    const link = document.createElement("a");
                                    link.href = cert.certificate_url;
                                    link.download = `sertifikat-${course.title.replace(
                                      /\s+/g,
                                      "-"
                                    )}.pdf`;
                                    link.click();
                                  }
                                }
                              } catch (error) {
                                console.error(
                                  "Error downloading certificate:",
                                  error
                                );
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
                          href={`/user/courses/${course.id}`}
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
                            if (
                              res.ok &&
                              json.success &&
                              json.items.length > 0
                            ) {
                              const cert = json.items[0];
                              if (cert.certificate_url) {
                                const link = document.createElement("a");
                                link.href = cert.certificate_url;
                                link.download = `sertifikat-${i.course?.title.replace(
                                  /\s+/g,
                                  "-"
                                )}.pdf`;
                                link.click();
                              }
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
