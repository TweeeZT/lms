"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Group,
  Badge,
  Card,
  Stack,
  Button,
  Skeleton,
  SimpleGrid,
  Box,
  Avatar,
  ThemeIcon,
  ActionIcon,
  Alert,
} from "@mantine/core";
import {
  IconShoppingCart,
  IconClock,
  IconSchool,
  IconLayersDifference,
  IconListDetails,
  IconFileText,
  IconLiveView,
  IconStar,
  IconUsersGroup,
  IconReload,
  IconBook,
  IconCalendar,
} from "@tabler/icons-react";
import Image from "next/image";

// Small utility helpers
const formatPrice = (v: number | null) =>
  `Rp ${(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
const levelColor = (level?: string | null) =>
  level === "beginner" ? "green" : level === "intermediate" ? "yellow" : "red";

interface PublicModule {
  id: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  order?: number | null;
  // For live sessions
  start_at?: string | null;
  duration_min?: number | null;
}
interface PublicCourse {
  id: string;
  title: string;
  description: string;
  thumbnail?: string | null;
  category: string;
  price: number | null;
  durationMin: number | null;
  level: string | null;
  totalModules: number | null;
  enrolledCount: number | null;
  rating: number | null;
  instructor?: { id: string; fullName: string; avatar?: string | null } | null;
}

export default function ExploreCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  // auth not required for public explore detail page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [modules, setModules] = useState<PublicModule[]>([]);
  const [overviewContent, setOverviewContent] = useState<string | null>(null);

  // derived - separate by type
  const overviewModule = useMemo(
    () => modules.find((m) => m.kind === "overview"),
    [modules]
  );
  const materiModules = useMemo(
    () => modules.filter((m) => m.kind === "materi"),
    [modules]
  );
  const quizModules = useMemo(
    () => modules.filter((m) => m.kind === "quiz"),
    [modules]
  );
  const tugasModules = useMemo(
    () => modules.filter((m) => m.kind === "tugas"),
    [modules]
  );
  const liveModules = useMemo(
    () => modules.filter((m) => m.kind === "live"),
    [modules]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user/courses/${id}/public`);
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat kursus");
        if (!active) return;
        setCourse(json.course);
        setModules(json.modules);

        // Load overview module content if exists
        const overviewMod = json.modules.find(
          (m: PublicModule) => m.kind === "overview"
        );
        if (overviewMod) {
          try {
            const summaryRes = await fetch(
              `/api/user/modules/${overviewMod.id}/summary`
            );
            const summaryJson = await summaryRes.json();
            if (summaryRes.ok && summaryJson.success) {
              setOverviewContent(summaryJson.text_content);
            }
          } catch {
            // Overview content optional, don't fail if not found
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat kursus");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Loading skeleton redesigned
  if (loading) {
    return (
      <Container size="lg" py="xl">
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="lg">
          <Skeleton height={220} radius="md" />
          <Skeleton height={220} radius="md" />
          <Skeleton height={220} radius="md" />
        </SimpleGrid>
        <Skeleton height={46} mb="sm" />
        <Skeleton height={20} mb="sm" />
        <Skeleton height={20} mb="sm" />
        <Skeleton height={300} radius="md" />
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      {error && (
        <Alert color="red" mb="lg" variant="light" title="Gagal Memuat">
          {error}
          <Group mt="sm" gap="xs">
            <ActionIcon
              variant="light"
              aria-label="reload"
              onClick={() => {
                setLoading(true);
                setError(null);
                setTimeout(() => setLoading(false), 10);
              }}
            >
              <IconReload size={18} />
            </ActionIcon>
          </Group>
        </Alert>
      )}
      {!error && course && (
        <Stack gap="xl">
          {/* Hero Section - Responsive */}
          <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0}>
              {/* Thumbnail */}
              <Box
                style={{
                  position: "relative",
                  width: "100%",
                  height: 280,
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
                  <Box
                    h="100%"
                    style={{
                      background: "var(--gradient-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "4rem",
                    }}
                  >
                    {course.category === "scratch" ? "🎨" : "🎮"}
                  </Box>
                )}
              </Box>

              {/* Course Info */}
              <Stack p="lg" gap="sm" justify="space-between">
                <div>
                  <Group gap="xs" mb="xs">
                    <Badge
                      color={course.category === "scratch" ? "orange" : "cyan"}
                      variant="filled"
                    >
                      {course.category}
                    </Badge>
                    {course.level && (
                      <Badge color={levelColor(course.level)} variant="light">
                        {course.level}
                      </Badge>
                    )}
                  </Group>
                  <Title order={2} mb="xs">
                    {course.title}
                  </Title>
                  <Text c="dimmed" size="sm" lineClamp={3}>
                    {course.description}
                  </Text>
                </div>

                <Stack gap="xs">
                  <Group gap="md" wrap="wrap">
                    <Group gap={4}>
                      <IconStar size={16} color="#f6d457" />
                      <Text size="sm">{course.rating ?? 0}</Text>
                    </Group>
                    <Group gap={4}>
                      <IconUsersGroup size={16} />
                      <Text size="sm">{course.enrolledCount ?? 0} siswa</Text>
                    </Group>
                    <Group gap={4}>
                      <IconClock size={16} />
                      <Text size="sm">{course.durationMin ?? 0} mnt</Text>
                    </Group>
                    <Group gap={4}>
                      <IconSchool size={16} />
                      <Text size="sm">{course.totalModules ?? 0} modul</Text>
                    </Group>
                  </Group>

                  {course.instructor && (
                    <Group gap="sm">
                      <Avatar
                        src={course.instructor.avatar}
                        radius="xl"
                        size="sm"
                      />
                      <div>
                        <Text size="sm" fw={500}>
                          {course.instructor.fullName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Instruktor
                        </Text>
                      </div>
                    </Group>
                  )}
                </Stack>
              </Stack>
            </SimpleGrid>

            {/* Purchase Section */}
            <Box
              p="lg"
              style={{
                borderTop: "1px solid var(--border-color)",
                background: "var(--hover-bg)",
              }}
            >
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text size="xs" c="dimmed">
                    Harga
                  </Text>
                  <Title order={3} c="green">
                    {formatPrice(course.price)}
                  </Title>
                </div>
                <Button
                  className="btn-primary"
                  leftSection={<IconShoppingCart size={16} />}
                  component="a"
                  href={`/school/checkout/${course.id}`}
                  radius="md"
                  size="md"
                >
                  Beli Kursus Sekarang
                </Button>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                ✓ Akses penuh selamanya • ✓ Update materi gratis • ✓ Sertifikat
              </Text>
            </Box>
          </Card>

          {/* Content Sections - Separated by Type */}
          <Stack gap="lg">
            {/* Overview Module - Always Visible (Free Preview) */}
            {overviewModule && (
              <Card
                withBorder
                radius="md"
                p="lg"
                style={{
                  background:
                    "linear-gradient(135deg, #f8f9fa 0%, #e7f5ff 100%)",
                }}
              >
                <Group mb="md" gap="xs">
                  <ThemeIcon variant="filled" color="blue" size="lg">
                    <IconBook size={20} />
                  </ThemeIcon>
                  <div>
                    <Group gap="xs">
                      <Text fw={700} size="lg">
                        {overviewModule.title}
                      </Text>
                      <Badge color="green" variant="filled" size="sm">
                        GRATIS
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Preview modul pengantar - Lihat sebelum membeli
                    </Text>
                  </div>
                </Group>
                {overviewModule.description && (
                  <Text size="sm" c="dimmed" mb="md">
                    {overviewModule.description}
                  </Text>
                )}
                {overviewContent && (
                  <Box
                    p="md"
                    style={{
                      background: "white",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      dangerouslySetInnerHTML={{ __html: overviewContent }}
                      className="overview-content"
                      style={{
                        fontSize: "0.95rem",
                        lineHeight: 1.8,
                        color: "var(--foreground)",
                      }}
                    />
                  </Box>
                )}
              </Card>
            )}

            <Title order={3}>Konten Kursus</Title>

            {/* Materi Section */}
            {materiModules.length > 0 && (
              <Card withBorder radius="md" p="lg">
                <Group mb="md" justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="blue" size="lg">
                      <IconBook size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Materi Pembelajaran</Text>
                      <Text size="xs" c="dimmed">
                        {materiModules.length} modul
                      </Text>
                    </div>
                  </Group>
                </Group>
                <Stack gap="xs">
                  {materiModules.map((m, idx) => (
                    <Card key={m.id} withBorder p="sm" radius="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" style={{ flex: 1 }}>
                          <ThemeIcon variant="light" size="sm" color="blue">
                            <IconLayersDifference size={14} />
                          </ThemeIcon>
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>
                              {idx + 1}. {m.title}
                            </Text>
                            {m.description && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {m.description}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Card>
            )}

            {/* Quiz Section */}
            {quizModules.length > 0 && (
              <Card withBorder radius="md" p="lg">
                <Group mb="md" justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="violet" size="lg">
                      <IconListDetails size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Kuis & Evaluasi</Text>
                      <Text size="xs" c="dimmed">
                        {quizModules.length} kuis
                      </Text>
                    </div>
                  </Group>
                </Group>
                <Stack gap="xs">
                  {quizModules.map((m, idx) => (
                    <Card key={m.id} withBorder p="sm" radius="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" style={{ flex: 1 }}>
                          <ThemeIcon variant="light" size="sm" color="violet">
                            <IconListDetails size={14} />
                          </ThemeIcon>
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>
                              {idx + 1}. {m.title}
                            </Text>
                            {m.description && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {m.description}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Card>
            )}

            {/* Tugas Section */}
            {tugasModules.length > 0 && (
              <Card withBorder radius="md" p="lg">
                <Group mb="md" justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="orange" size="lg">
                      <IconFileText size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Tugas & Proyek</Text>
                      <Text size="xs" c="dimmed">
                        {tugasModules.length} tugas
                      </Text>
                    </div>
                  </Group>
                </Group>
                <Stack gap="xs">
                  {tugasModules.map((m, idx) => (
                    <Card key={m.id} withBorder p="sm" radius="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" style={{ flex: 1 }}>
                          <ThemeIcon variant="light" size="sm" color="orange">
                            <IconFileText size={14} />
                          </ThemeIcon>
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>
                              {idx + 1}. {m.title}
                            </Text>
                            {m.description && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {m.description}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Card>
            )}

            {/* Live Sessions Section */}
            {liveModules.length > 0 && (
              <Card withBorder radius="md" p="lg">
                <Group mb="md" justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="teal" size="lg">
                      <IconLiveView size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Sesi Live</Text>
                      <Text size="xs" c="dimmed">
                        {liveModules.length} jadwal
                      </Text>
                    </div>
                  </Group>
                </Group>
                <Stack gap="xs">
                  {liveModules.map((lm) => {
                    const startDate = lm.start_at
                      ? new Date(lm.start_at)
                      : null;
                    const formattedDate = startDate
                      ? startDate.toLocaleDateString("id-ID", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : null;
                    const formattedTime = startDate
                      ? startDate.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;
                    const duration = lm.duration_min || 60;

                    return (
                      <Card
                        key={lm.id}
                        withBorder
                        p="sm"
                        radius="sm"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(32, 201, 151, 0.05), rgba(255, 255, 255, 0))",
                        }}
                      >
                        <Group justify="space-between" align="flex-start">
                          <Group
                            gap="sm"
                            align="flex-start"
                            style={{ flex: 1 }}
                          >
                            <ThemeIcon variant="filled" size="md" color="teal">
                              <IconLiveView size={16} />
                            </ThemeIcon>
                            <div style={{ flex: 1 }}>
                              <Text size="sm" fw={500} mb={4}>
                                {lm.title}
                              </Text>
                              {lm.description && (
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  lineClamp={2}
                                  mb="xs"
                                >
                                  {lm.description}
                                </Text>
                              )}
                              {formattedDate && (
                                <Group gap="xs" mb={4}>
                                  <IconCalendar size={14} color="gray" />
                                  <Text size="xs" c="dimmed">
                                    {formattedDate}
                                  </Text>
                                </Group>
                              )}
                              {formattedTime && (
                                <Group gap="xs">
                                  <IconClock size={14} color="gray" />
                                  <Text size="xs" c="dimmed">
                                    {formattedTime} ({duration} menit)
                                  </Text>
                                </Group>
                              )}
                            </div>
                          </Group>
                          <Badge size="sm" variant="filled" color="teal">
                            LIVE
                          </Badge>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </Card>
            )}

            {/* Empty State */}
            {modules.length === 0 && (
              <Card withBorder p="xl" radius="md">
                <Stack align="center" gap="sm">
                  <IconSchool size={48} color="gray" />
                  <Text c="dimmed" size="sm">
                    Belum ada modul tersedia.
                  </Text>
                </Stack>
              </Card>
            )}
          </Stack>
        </Stack>
      )}
    </Container>
  );
}
