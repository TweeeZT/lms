"use client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Title,
  Paper,
  TextInput,
  Button,
  Grid,
  Card,
  Image,
  Text,
  Badge,
  Group,
  Loader,
} from "@mantine/core";
import { IconSearch, IconBook, IconShoppingCart } from "@tabler/icons-react";

type CourseRow = {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  category: string;
  price: number;
  duration_min?: number;
  level: string;
  total_modules?: number;
  enrolled_count?: number;
  rating?: number;
  is_published?: boolean;
  points?: number;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SchoolCoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchCourses = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      params.set("schoolUserId", user.id);

      const res = await fetch(`/api/school/purchased-courses?${params}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setCourses(json.courses);
      } else {
        setError(json.error || "Gagal memuat kursus");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchCourses();
    }
  }, [search, user?.id]);

  return (
    <Box p="lg">
      <Title order={2} mb="lg" style={{ color: "var(--primary-color)" }}>
        Kursus Terbeli
      </Title>

      <Paper withBorder p="md" radius="md" mb="lg">
        <Group>
          <TextInput
            placeholder="Cari kursus..."
            leftSection={<IconSearch size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<IconShoppingCart size={18} />}
            onClick={() => router.push("/school/explore")}
            style={{ background: "var(--primary-color)" }}
          >
            Beli Kursus Baru
          </Button>
        </Group>
      </Paper>

      {loading && (
        <Box style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader size="lg" />
        </Box>
      )}

      {error && (
        <Paper
          withBorder
          p="lg"
          radius="md"
          style={{ background: "#fee", color: "#c00" }}
        >
          <Text>{error}</Text>
        </Paper>
      )}

      {!loading && !error && (
        <Grid gutter="lg">
          {courses.length === 0 && (
            <Grid.Col span={12}>
              <Paper withBorder p="xl" radius="md">
                <Text c="dimmed" ta="center">
                  Belum ada kursus yang dibeli. Klik tombol &quot;Beli Kursus
                  Baru&quot; untuk membeli.
                </Text>
              </Paper>
            </Grid.Col>
          )}
          {courses.map((course) => (
            <Grid.Col key={course.id} span={{ base: 12, sm: 6, md: 4 }}>
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                className="course-card"
              >
                <Card.Section>
                  <Image
                    src={course.thumbnail || "/placeholder.png"}
                    height={160}
                    alt={course.title}
                  />
                </Card.Section>

                <Group justify="space-between" mt="md" mb="xs">
                  <Text fw={600} lineClamp={1}>
                    {course.title}
                  </Text>
                  <Badge color="blue">{course.level}</Badge>
                </Group>

                <Text size="sm" c="dimmed" lineClamp={2} mb="md">
                  {course.description || "Tidak ada deskripsi"}
                </Text>

                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">
                    <IconBook
                      size={16}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    {course.total_modules || 0} Modul
                  </Text>
                  <Text size="sm" c="dimmed">
                    {course.rating
                      ? `⭐ ${course.rating.toFixed(1)}`
                      : "⭐ 0.0"}
                  </Text>
                </Group>

                <Text
                  fw={700}
                  size="lg"
                  style={{ color: "var(--primary-color)" }}
                  mt="md"
                >
                  {rupiah(course.price || 0)}
                </Text>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}
    </Box>
  );
}
