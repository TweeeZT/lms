"use client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
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
  Select,
  Loader,
  Pagination,
} from "@mantine/core";
import {
  IconSearch,
  IconBook,
  IconShoppingCart,
  IconStar,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";

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
  instructor_id?: string;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SchoolExplorePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      if (level) params.set("level", level);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const res = await fetch(`/api/school/explore?${params}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setCourses(json.courses);
        setTotal(json.total);
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
    fetchCourses();
  }, [search, category, level, page]);

  useEffect(() => {
    setPage(1);
  }, [search, category, level]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Box p="lg">
      <Title order={2} mb="lg" style={{ color: "var(--primary-color)" }}>
        Jelajahi Kursus
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
          <Select
            placeholder="Kategori"
            data={[
              { value: "", label: "Semua" },
              { value: "scratch", label: "Scratch" },
              { value: "roblox", label: "Roblox" },
              { value: "robotics", label: "Robotics" },
            ]}
            value={category}
            onChange={(val) => setCategory(val || "")}
            style={{ width: 160 }}
            clearable
          />
          <Select
            placeholder="Level"
            data={[
              { value: "", label: "Semua" },
              { value: "beginner", label: "Pemula" },
              { value: "intermediate", label: "Menengah" },
              { value: "advanced", label: "Lanjutan" },
            ]}
            value={level}
            onChange={(val) => setLevel(val || "")}
            style={{ width: 160 }}
            clearable
          />
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
        <>
          <Grid gutter="lg">
            {courses.length === 0 && (
              <Grid.Col span={12}>
                <Paper withBorder p="xl" radius="md">
                  <Text c="dimmed" ta="center">
                    Tidak ada kursus ditemukan
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
                  style={{ cursor: "pointer", height: "100%" }}
                  onClick={() => router.push(`/school/explore/${course.id}`)}
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
                    <Group gap="xs">
                      <IconBook size={16} />
                      <Text size="sm" c="dimmed">
                        {course.total_modules || 0} Modul
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <IconStar size={16} style={{ color: "#ffd700" }} />
                      <Text size="sm" c="dimmed">
                        {course.rating?.toFixed(1) || "0.0"}
                      </Text>
                    </Group>
                  </Group>

                  <Group justify="space-between" align="center" mt="md">
                    <Text
                      fw={700}
                      size="lg"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {rupiah(course.price || 0)}
                    </Text>
                    <Badge variant="light" color="green">
                      {course.enrolled_count || 0} siswa
                    </Badge>
                  </Group>
                </Card>
              </Grid.Col>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </>
      )}
    </Box>
  );
}
