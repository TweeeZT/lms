"use client";

import { useCallback, useEffect, useState } from "react";
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
  TextInput,
  Select,
  SimpleGrid,
  Image,
  Skeleton,
} from "@mantine/core";
import {
  IconSearch,
  IconFilter,
  IconBook,
  IconStar,
  IconUsers,
  IconClock,
  IconShoppingCart,
} from "@tabler/icons-react";
import { useAuth } from "../../../hooks/useAuth";
import PrimeLoader from "../../../components/PrimeLoader";

export default function UserExplorePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>("all");
  const [levelFilter, setLevelFilter] = useState<string | null>("all");
  const [sort] = useState<string | null>("latest");
  const [page, setPage] = useState(1);
  const limit = 9;
  const [total, setTotal] = useState(0);
  type ExploreCourse = {
    id: string;
    title: string;
    description: string;
    thumbnail?: string | null;
    category: string;
    price: number | null;
    durationMin: number | null;
    level: "beginner" | "intermediate" | "advanced";
    totalModules: number;
    enrolledCount: number | null;
    rating: number | null;
    instructor?: {
      id: string;
      fullName: string;
      avatar?: string | null;
    } | null;
  };
  const [items, setItems] = useState<ExploreCourse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        category: categoryFilter || "all",
        level: levelFilter || "all",
        sort: sort || "latest",
        page: String(page),
        limit: String(limit),
        userId: user?.id || "",
      });
      const res = await fetch(`/api/user/courses/explore?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.items);
        setTotal(json.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, levelFilter, sort, page, limit, user?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, levelFilter, sort]);

  // enroll handled via checkout flow now

  if (loading && items.length === 0) {
    return <PrimeLoader />;
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            Jelajahi Kursus
          </Title>
          <Text size="lg" c="dimmed">
            Temukan kursus yang sesuai dengan minat dan level Anda
          </Text>
        </div>

        {/* Search and Filters */}
        <Card padding="lg" radius="md">
          <Grid gutter="md" align="end">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                placeholder="Cari kursus..."
                leftSection={<IconSearch size="1rem" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Select
                placeholder="Kategori"
                leftSection={<IconFilter size="1rem" />}
                data={[
                  { value: "all", label: "Semua Kategori" },
                  { value: "scratch", label: "Scratch" },
                  { value: "roblox", label: "Roblox" },
                ]}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Select
                placeholder="Level"
                data={[
                  { value: "all", label: "Semua Level" },
                  { value: "beginner", label: "Pemula" },
                  { value: "intermediate", label: "Menengah" },
                  { value: "advanced", label: "Lanjutan" },
                ]}
                value={levelFilter}
                onChange={setLevelFilter}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Course Grid */}
        {loading && items.length === 0 ? (
          <Stack gap="md">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={260} radius="md" />
            ))}
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {items.map((course) => (
              <Card key={course.id} radius="lg" className="course-card">
                <Card.Section>
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      h={200}
                      fit="cover"
                    />
                  ) : (
                    <div
                      style={{
                        height: 200,
                        background: "var(--gradient-accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "2rem",
                        fontWeight: 700,
                      }}
                    >
                      {course.category === "scratch" ? "🎨" : "🎮"}
                    </div>
                  )}
                </Card.Section>

                <Stack p="md" gap="sm">
                  <Group justify="space-between">
                    <Badge
                      variant="light"
                      color={course.category === "scratch" ? "orange" : "cyan"}
                    >
                      {course.category}
                    </Badge>
                    <Badge
                      variant="light"
                      color={
                        course.level === "beginner"
                          ? "green"
                          : course.level === "intermediate"
                          ? "yellow"
                          : "red"
                      }
                    >
                      {course.level === "beginner"
                        ? "Pemula"
                        : course.level === "intermediate"
                        ? "Menengah"
                        : "Lanjutan"}
                    </Badge>
                  </Group>

                  <Title order={4} lineClamp={2}>
                    {course.title}
                  </Title>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "var(--mantine-color-dimmed)",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: course.description || "",
                    }}
                  />

                  <Group gap="xs" mb="sm">
                    <IconUsers size="1rem" />
                    <Text size="sm">{course.enrolledCount || 0} siswa</Text>
                    <IconStar size="1rem" color="gold" />
                    <Text size="sm">
                      {course.rating?.toFixed?.(1) ?? course.rating}
                    </Text>
                    <IconClock size="1rem" />
                    <Text size="sm">
                      {Math.round((course.durationMin || 0) / 60)}h
                    </Text>
                  </Group>

                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="lg" fw={700} c="green">
                        Rp {(course.price || 0).toLocaleString()}
                      </Text>
                      <Text size="xs" c="dimmed">
                        oleh {course.instructor?.fullName || "-"}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Button
                        variant="light"
                        size="sm"
                        p={8}
                        component="a"
                        href={`/school/explore/${course.id}`}
                      >
                        Detail
                      </Button>
                      <Button
                        className="btn-primary"
                        size="sm"
                        leftSection={<IconShoppingCart size="1rem" />}
                        component="a"
                        href={`/school/checkout/${course.id}`}
                      >
                        Beli
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {items.length === 0 && !loading && (
          <Card padding="xl" radius="md">
            <Stack align="center" gap="md">
              <IconBook size="3rem" color="gray" />
              <Text size="lg" c="dimmed">
                Tidak ada kursus ditemukan
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Coba ubah filter atau kata kunci pencarian Anda
              </Text>
            </Stack>
          </Card>
        )}

        {total > limit && (
          <Group justify="center" mt="lg">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Array.from(
                { length: Math.ceil(total / limit) },
                (_, i) => i + 1
              ).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "filled" : "light"}
                  size="xs"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </Group>
        )}
      </Stack>
    </Container>
  );
}
