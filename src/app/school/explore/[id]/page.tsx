"use client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Group,
  Badge,
  Card,
  Stack,
  Button,
  SimpleGrid,
  Box,
  Avatar,
  ThemeIcon,
  Alert,
  Modal,
  Loader,
} from "@mantine/core";
import {
  IconShoppingCart,
  IconClock,
  IconSchool,
  IconLayersDifference,
  IconBook,
  IconStar,
  IconUsersGroup,
  IconUsers,
  IconAlertCircle,
} from "@tabler/icons-react";
import Image from "next/image";
import { notifications } from "@mantine/notifications";

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

export default function SchoolCourseDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user/courses/${courseId}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setCourse(json.course);
        } else {
          setError(json.error || "Gagal memuat kursus");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    };

    const fetchTotalStudents = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(
          `/api/school/students?schoolUserId=${user.id}&limit=1`
        );
        const json = await res.json();
        if (res.ok && json.success) {
          setTotalStudents(json.total);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchCourse();
    fetchTotalStudents();
  }, [courseId, user?.id]);

  const handleBuy = async () => {
    if (!user?.id || !courseId) return;

    setBuying(true);
    try {
      const res = await fetch("/api/school/purchase-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolUserId: user.id,
          courseId,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          color: "green",
          title: "Berhasil",
          message: json.message,
        });
        setBuyOpen(false);
        router.push("/school/courses");
      } else {
        notifications.show({
          color: "red",
          title: "Error",
          message: json.error || "Gagal membeli kursus",
        });
      }
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <Box
        p="lg"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Loader size="lg" />
      </Box>
    );
  }

  if (error || !course) {
    return (
      <Box p="lg">
        <Paper
          withBorder
          p="lg"
          radius="md"
          style={{ background: "#fee", color: "#c00" }}
        >
          <Text>{error || "Kursus tidak ditemukan"}</Text>
        </Paper>
        <Button mt="md" onClick={() => router.push("/school/explore")}>
          Kembali
        </Button>
      </Box>
    );
  }

  const totalPrice = (course.price || 0) * totalStudents;

  return (
    <Box p="lg">
      <Button variant="subtle" onClick={() => router.back()} mb="lg">
        ← Kembali
      </Button>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="xl" radius="lg">
            <Image
              src={course.thumbnail || "/placeholder.png"}
              height={300}
              radius="md"
              alt={course.title}
              mb="lg"
            />

            <Title order={2} mb="sm" style={{ color: "var(--primary-color)" }}>
              {course.title}
            </Title>

            <Group mb="lg" gap="xs">
              <Badge color="blue">{course.level}</Badge>
              <Badge color="green">{course.category}</Badge>
            </Group>

            <Text size="lg" mb="xl">
              {course.description || "Tidak ada deskripsi"}
            </Text>

            <Grid gutter="md">
              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Group gap="xs">
                    <IconBook size={20} />
                    <div>
                      <Text size="sm" c="dimmed">
                        Total Modul
                      </Text>
                      <Text fw={600}>{course.total_modules || 0}</Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Group gap="xs">
                    <IconClock size={20} />
                    <div>
                      <Text size="sm" c="dimmed">
                        Durasi
                      </Text>
                      <Text fw={600}>{course.duration_min || 0} menit</Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Group gap="xs">
                    <IconUsers size={20} />
                    <div>
                      <Text size="sm" c="dimmed">
                        Siswa Terdaftar
                      </Text>
                      <Text fw={600}>{course.enrolled_count || 0}</Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Group gap="xs">
                    <IconStar size={20} style={{ color: "#ffd700" }} />
                    <div>
                      <Text size="sm" c="dimmed">
                        Rating
                      </Text>
                      <Text fw={600}>{course.rating?.toFixed(1) || "0.0"}</Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper
            withBorder
            p="xl"
            radius="lg"
            style={{ position: "sticky", top: 20 }}
          >
            <Title order={3} mb="md">
              Pembelian
            </Title>

            <Group justify="space-between" mb="xs">
              <Text size="sm">Harga per siswa:</Text>
              <Text fw={600}>{rupiah(course.price)}</Text>
            </Group>

            <Group justify="space-between" mb="xs">
              <Text size="sm">Jumlah siswa:</Text>
              <Text fw={600}>{totalStudents}</Text>
            </Group>

            <hr style={{ margin: "16px 0" }} />

            <Group justify="space-between" mb="xl">
              <Text fw={700}>Total:</Text>
              <Text
                fw={700}
                size="xl"
                style={{ color: "var(--primary-color)" }}
              >
                {rupiah(totalPrice)}
              </Text>
            </Group>

            <Button
              fullWidth
              size="lg"
              leftSection={<IconShoppingCart size={20} />}
              onClick={() => setBuyOpen(true)}
              style={{ background: "var(--primary-color)" }}
              disabled={totalStudents === 0}
            >
              Beli Sekarang
            </Button>

            {totalStudents === 0 && (
              <Text size="xs" c="red" mt="sm" ta="center">
                Tambahkan siswa terlebih dahulu
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Buy Confirmation Modal */}
      <Modal
        opened={buyOpen}
        onClose={() => setBuyOpen(false)}
        title="Konfirmasi Pembelian"
        size="md"
      >
        <Paper withBorder p="md" radius="md" mb="md">
          <Text fw={600} mb="xs">
            {course.title}
          </Text>
          <Group justify="space-between" mb="xs">
            <Text size="sm">Harga per siswa:</Text>
            <Text fw={600}>{rupiah(course.price)}</Text>
          </Group>
          <Group justify="space-between" mb="xs">
            <Text size="sm">Jumlah siswa:</Text>
            <Text fw={600}>{totalStudents}</Text>
          </Group>
          <hr style={{ margin: "12px 0" }} />
          <Group justify="space-between">
            <Text fw={700}>Total Pembayaran:</Text>
            <Text fw={700} size="lg" style={{ color: "var(--primary-color)" }}>
              {rupiah(totalPrice)}
            </Text>
          </Group>
        </Paper>

        <Text size="sm" c="dimmed" mb="md">
          Kursus ini akan otomatis didaftarkan untuk semua siswa yang sudah
          diterima di sekolah Anda.
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setBuyOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={handleBuy}
            loading={buying}
            style={{ background: "var(--primary-color)" }}
            leftSection={<IconShoppingCart size={16} />}
          >
            Beli Sekarang
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
