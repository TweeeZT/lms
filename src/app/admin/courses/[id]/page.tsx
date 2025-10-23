"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconPlus,
  IconTrash,
  IconBook,
  IconClock,
  IconUser,
  IconPencil,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

interface Course {
  id: string;
  instructor_id?: string;
  title: string;
  description: string | null;
  thumbnail?: string | null;
  category: string | null;
  price: number | null;
  duration_min?: number | null;
  level: string | null;
  enrolled_count?: number | null;
  rating?: number | null;
  is_published?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

interface ModuleItem {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  module_kind: "materi" | "quiz" | "tugas" | "live";
  is_published: boolean | null;
  created_at?: string;
  updated_at?: string;
}

const kindLabels: Record<string, string> = {
  materi: "Materi",
  quiz: "Kuis",
  tugas: "Tugas",
  live: "Kelas Live",
};

const levelLabels: Record<string, string> = {
  beginner: "Pemula",
  intermediate: "Menengah",
  advanced: "Lanjutan",
};

export default function AdminCourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<ModuleItem | null>(null);

  const adminId = user?.id || "";

  const fetchData = useCallback(async () => {
    if (!adminId || !courseId) return;
    setLoading(true);
    setError(null);
    try {
      // fetch single course detail via dedicated endpoint
      const courseRes = await fetch(
        `/api/admin/courses/${courseId}?userId=${adminId}`
      );
      const courseJson = await courseRes.json();
      if (!courseRes.ok || !courseJson.success) {
        throw new Error(courseJson.error || "Gagal memuat data course");
      }
      setCourse(courseJson.item);

      // fetch modules
      const modulesRes = await fetch(
        `/api/admin/courses/${courseId}/modules?userId=${adminId}`
      );
      if (!modulesRes.ok) throw new Error("Gagal memuat modules");
      const modulesJson = await modulesRes.json();
      setModules(modulesJson.items || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [adminId, courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // No more ordering needed - modules are displayed in creation order
  const sortedModules = modules;

  const handleDelete = async () => {
    if (!showDelete || !adminId) return;
    try {
      const res = await fetch(
        `/api/admin/modules/${showDelete.id}?userId=${adminId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Gagal menghapus modul");
      setShowDelete(null);
      fetchData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus modul";
      alert(msg);
    }
  };

  const toHrs = (min: number | null | undefined) => {
    const m = Number(min || 0);
    return `${Math.floor(m / 60)}j ${m % 60}m`;
  };

  return (
    <Container size="xl" pb="xl">
      {error && (
        <Alert color="red" mb="md" title="Error">
          {error}
        </Alert>
      )}
      {loading && (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      )}
      {!loading && course && (
        <Stack gap="lg">
          <Group justify="space-between">
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconChevronLeft size="1rem" />}
                onClick={() => router.push("/admin/courses")}
              >
                Kembali
              </Button>
              <div>
                <Title order={2}>{course.title}</Title>
                <Text c="dimmed">Detail kursus dan modul</Text>
              </div>
            </Group>
            <Badge
              variant="light"
              color={course.is_published ? "green" : "gray"}
            >
              {course.is_published ? "Dipublikasikan" : "Draft"}
            </Badge>
          </Group>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Card padding="lg" radius="md">
                <Stack gap="sm">
                  <Text>{course.description || "Tidak ada deskripsi"}</Text>
                  <Group gap="md">
                    <Group gap={6}>
                      <IconBook size="1rem" />
                      <Text size="sm">{sortedModules.length} modul</Text>
                    </Group>
                    <Group gap={6}>
                      <IconClock size="1rem" />
                      <Text size="sm">{toHrs(course.duration_min)}</Text>
                    </Group>
                    <Group gap={6}>
                      <IconUser size="1rem" />
                      <Text size="sm">{course.enrolled_count || 0} siswa</Text>
                    </Group>
                  </Group>
                </Stack>
              </Card>

              <Card padding="lg" radius="md" mt="lg">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Daftar Modul ({sortedModules.length})</Title>
                  <Button
                    size="xs"
                    leftSection={<IconPlus size="1rem" />}
                    onClick={() =>
                      router.push(`/admin/courses/${course.id}/modules/new`)
                    }
                  >
                    Tambah Modul
                  </Button>
                </Group>
                {sortedModules.length === 0 ? (
                  <Paper p="xl" withBorder style={{ textAlign: "center" }}>
                    <Text c="dimmed" size="sm">
                      Belum ada modul. Klik tombol di atas untuk menambah modul
                      pertama.
                    </Text>
                  </Paper>
                ) : (
                  <Stack gap="sm">
                    {sortedModules.map((m, idx) => {
                      return (
                        <Card key={m.id} padding="md" withBorder>
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap="md" style={{ flex: 1 }}>
                              <Badge size="lg" variant="filled" color="blue">
                                #{idx + 1}
                              </Badge>
                              <Stack gap={4} style={{ flex: 1 }}>
                                <Group gap="xs">
                                  <Text fw={600} size="sm">
                                    {m.title}
                                  </Text>
                                  <Badge
                                    size="sm"
                                    variant="light"
                                    color={
                                      m.module_kind === "materi"
                                        ? "blue"
                                        : m.module_kind === "quiz"
                                        ? "grape"
                                        : m.module_kind === "tugas"
                                        ? "orange"
                                        : "pink"
                                    }
                                  >
                                    {kindLabels[m.module_kind] || m.module_kind}
                                  </Badge>
                                  <Badge
                                    size="sm"
                                    color={m.is_published ? "green" : "gray"}
                                    variant="dot"
                                  >
                                    {m.is_published
                                      ? "Dipublikasikan"
                                      : "Draft"}
                                  </Badge>
                                </Group>
                                {m.description && (
                                  <Text size="xs" c="dimmed" lineClamp={1}>
                                    {m.description}
                                  </Text>
                                )}
                              </Stack>
                            </Group>
                            <Group gap={6}>
                              <Tooltip label="Edit Modul">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  size="lg"
                                  onClick={() =>
                                    router.push(
                                      `/admin/courses/${course.id}/modules/${m.id}/edit`
                                    )
                                  }
                                >
                                  <IconPencil size="1.1rem" />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Hapus Modul">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  size="lg"
                                  onClick={() => setShowDelete(m)}
                                >
                                  <IconTrash size="1.1rem" />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper p="lg" radius="md" withBorder>
                <Title order={4} mb="sm">
                  Info Kursus
                </Title>
                <Stack gap={8}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Kategori
                    </Text>
                    <Badge
                      variant="light"
                      color={
                        (course.category || "scratch") === "scratch"
                          ? "orange"
                          : "cyan"
                      }
                    >
                      {course.category}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Level
                    </Text>
                    <Badge variant="light">
                      {levelLabels[course.level || "beginner"] || course.level}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Harga
                    </Text>
                    <Text fw={700}>
                      Rp {(course.price || 0).toLocaleString("id-ID")}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Rating
                    </Text>
                    <Text fw={600}>{course.rating ?? 0}/5</Text>
                  </Group>
                  <Divider my="sm" />
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Dibuat
                    </Text>
                    <Text size="sm">
                      {course.created_at
                        ? new Date(course.created_at).toLocaleDateString(
                            "id-ID"
                          )
                        : ""}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Diperbarui
                    </Text>
                    <Text size="sm">
                      {course.updated_at
                        ? new Date(course.updated_at).toLocaleDateString(
                            "id-ID"
                          )
                        : ""}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      )}
      <Modal
        opened={!!showDelete}
        onClose={() => setShowDelete(null)}
        title="Hapus Modul"
        centered
      >
        <Text mb="md">
          Anda yakin ingin menghapus modul &quot;{showDelete?.title}&quot;?
          Tindakan ini tidak dapat dibatalkan.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setShowDelete(null)}>
            Batal
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            leftSection={<IconTrash size={16} />}
          >
            Hapus
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
