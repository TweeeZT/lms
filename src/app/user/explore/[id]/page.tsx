"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Group,
  Badge,
  Image,
  Card,
  Stack,
  Button,
  Skeleton,
  SimpleGrid,
  Box,
  Avatar,
  Accordion,
  ScrollArea,
  Tooltip,
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
} from "@tabler/icons-react";

// Small utility helpers
const formatPrice = (v: number | null) =>
  `Rp ${(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
const kindIcon = (kind?: string | null) => {
  switch (kind) {
    case "quiz":
      return IconListDetails;
    case "tugas":
      return IconFileText;
    case "live":
      return IconLiveView;
    case "materi":
    default:
      return IconLayersDifference;
  }
};
const levelColor = (level?: string | null) =>
  level === "beginner" ? "green" : level === "intermediate" ? "yellow" : "red";

interface PublicModule {
  id: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  order?: number | null;
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

  // derived
  const liveModules = useMemo(
    () => modules.filter((m) => m.kind === "live"),
    [modules]
  );
  const otherModules = useMemo(
    () => modules.filter((m) => m.kind !== "live"),
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
    <Container size="lg" py="xl">
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
                // re-trigger effect
                setTimeout(() => {
                  setLoading(false);
                }, 10);
              }}
            >
              <IconReload size={18} />
            </ActionIcon>
          </Group>
        </Alert>
      )}
      {!error && course && (
        <Stack gap="xl">
          {/* Hero Section */}
          <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
            <Group align="stretch" gap={0} wrap="nowrap">
              <Box style={{ flex: "0 0 360px" }}>
                {course.thumbnail ? (
                  <Image
                    src={course.thumbnail}
                    alt={course.title}
                    radius={0}
                    h={260}
                    fit="cover"
                  />
                ) : (
                  <Box
                    h={260}
                    style={{
                      background: "var(--gradient-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "3rem",
                      fontWeight: 700,
                    }}
                  >
                    {course.category === "scratch" ? "🎨" : "🎮"}
                  </Box>
                )}
              </Box>
              <Stack p="lg" gap="sm" style={{ flex: 1 }}>
                <Group gap="xs">
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
                <Title order={2}>{course.title}</Title>
                <Text
                  c="dimmed"
                  size="sm"
                  lineClamp={4}
                  style={{ maxWidth: 720 }}
                >
                  {course.description}
                </Text>
                <Group gap="xl" wrap="wrap" mt="sm">
                  <Group gap={4}>
                    <IconStar size={16} color="#f6d457" />
                    <Text size="sm">{course.rating ?? 0} rating</Text>
                  </Group>
                  <Group gap={4}>
                    <IconUsersGroup size={16} />
                    <Text size="sm">{course.enrolledCount ?? 0} siswa</Text>
                  </Group>
                  <Group gap={4}>
                    <IconClock size={16} />
                    <Text size="sm">{course.durationMin ?? 0} mnt</Text>
                  </Group>
                </Group>
                {course.instructor && (
                  <Group mt="sm" gap="sm">
                    <Avatar src={course.instructor.avatar} radius="xl" />
                    <div>
                      <Text size="sm" fw={600}>
                        {course.instructor.fullName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Instruktor
                      </Text>
                    </div>
                  </Group>
                )}
              </Stack>
              {/* Sticky Purchase Panel */}
              <Box
                visibleFrom="md"
                style={{
                  width: 300,
                  borderLeft: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <Stack p="lg" gap="sm" style={{ position: "sticky", top: 100 }}>
                  <Title order={4} c="green">
                    {formatPrice(course.price)}
                  </Title>
                  <Button
                    className="btn-primary"
                    leftSection={<IconShoppingCart size={16} />}
                    component="a"
                    href={`/user/checkout/${course.id}`}
                    radius="md"
                    size="md"
                  >
                    Beli Kursus
                  </Button>
                  <Text size="xs" c="dimmed">
                    Akses penuh selamanya • Update materi gratis
                  </Text>
                </Stack>
              </Box>
            </Group>
          </Card>

          {/* Stats Grid (mobile) */}
          <Box hiddenFrom="md">
            <Card withBorder mb="sm" p="md" radius="md">
              <Group justify="space-between" wrap="wrap" gap="md">
                <Group gap={4}>
                  <IconStar size={16} color="#f6d457" />
                  <Text size="xs">{course.rating ?? 0} rating</Text>
                </Group>
                <Group gap={4}>
                  <IconUsersGroup size={16} />
                  <Text size="xs">{course.enrolledCount ?? 0} siswa</Text>
                </Group>
                <Group gap={4}>
                  <IconClock size={16} />
                  <Text size="xs">{course.durationMin ?? 0} mnt</Text>
                </Group>
                <Group gap={4}>
                  <IconSchool size={16} />
                  <Text size="xs">{course.totalModules ?? 0} modul</Text>
                </Group>
              </Group>
            </Card>
            <Card withBorder p="md" radius="md" mb="lg">
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>
                    {formatPrice(course.price)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Akses penuh
                  </Text>
                </div>
                <Button
                  className="btn-primary"
                  leftSection={<IconShoppingCart size={16} />}
                  component="a"
                  href={`/user/checkout/${course.id}`}
                  size="sm"
                >
                  Beli
                </Button>
              </Group>
            </Card>
          </Box>

          {/* Modules Section */}
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={3}>Daftar Modul</Title>
              <Badge variant="light" leftSection={<IconSchool size={14} />}>
                {modules.length} total
              </Badge>
            </Group>
            {modules.length === 0 && (
              <Card withBorder p="xl" radius="md">
                <Text c="dimmed" size="sm">
                  Belum ada modul.
                </Text>
              </Card>
            )}
            {modules.length > 0 && (
              <Accordion
                radius="md"
                variant="separated"
                multiple // aktifkan multiple
                defaultValue={otherModules.map((m) => m.id)} // array string sekarang valid
                chevron={null} // hilangkan panah toggle
              >
                {otherModules.map((m, idx) => {
                  const Ico = kindIcon(m.kind);
                  return (
                    <Accordion.Item key={m.id} value={m.id}>
                      <Accordion.Control
                        icon={
                          <ThemeIcon variant="light" size="sm">
                            <Ico size={16} />
                          </ThemeIcon>
                        }
                      >
                        <Group gap={6}>
                          <Text size="sm" fw={500}>
                            {idx + 1}. {m.title}
                          </Text>
                          {m.kind && (
                            <Tooltip label={m.kind}>
                              <Badge size="sm" variant="light" color="blue">
                                {m.kind}
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {m.description ? (
                          <Text size="sm" c="dimmed" maw={780}>
                            {m.description}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed" fs="italic">
                            Tidak ada deskripsi.
                          </Text>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </Stack>

          {/* Live Sessions Section */}
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={3}>Jadwal Live</Title>
              <Badge variant="light" leftSection={<IconLiveView size={14} />}>
                {liveModules.length}
              </Badge>
            </Group>
            {liveModules.length === 0 && (
              <Card withBorder p="lg" radius="md">
                <Text size="sm" c="dimmed">
                  Belum ada sesi live.
                </Text>
              </Card>
            )}
            {liveModules.length > 0 && (
              <ScrollArea h={240} type="auto" offsetScrollbars>
                <Stack>
                  {liveModules.map((lm) => (
                    <Card key={lm.id} withBorder radius="md" p="sm">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs">
                          <ThemeIcon variant="light" color="teal">
                            <IconLiveView size={16} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>
                              {lm.title}
                            </Text>
                            {lm.description && (
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {lm.description}
                              </Text>
                            )}
                          </div>
                        </Group>
                        <Badge size="xs" variant="outline" color="teal">
                          LIVE
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Stack>
        </Stack>
      )}
    </Container>
  );
}
