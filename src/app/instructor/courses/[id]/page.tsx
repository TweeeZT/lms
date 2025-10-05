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
  IconAlertTriangle,
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
  total_modules?: number | null;
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
  order_index: number | null;
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

export default function InstructorCourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<ModuleItem | null>(null);

  const instructorId = user?.id || "";

  const fetchData = useCallback(async () => {
    if (!instructorId || !courseId) return;
    setLoading(true);
    setError(null);
    try {
      // fetch single course detail
      const courseRes = await fetch(
        `/api/instructor/courses/${courseId}?instructorId=${instructorId}`
      );
      const courseJson = await courseRes.json();
      if (!courseRes.ok || !courseJson.success) {
        throw new Error(courseJson.error || "Gagal memuat data kursus");
      }
      setCourse(courseJson.item);

      // fetch modules
      const modulesRes = await fetch(
        `/api/instructor/courses/${courseId}/modules?instructorId=${instructorId}`
      );
      if (!modulesRes.ok) throw new Error("Gagal memuat modul");
      const modulesJson = await modulesRes.json();
      setModules(modulesJson.items || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [instructorId, courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedModules = useMemo(
    () =>
      [...modules].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [modules]
  );

  // Check for order issues
  const orderWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (let i = 0; i < sortedModules.length; i++) {
      const current = sortedModules[i].order_index || 0;
      const expected = i + 1;
      if (current !== expected) {
        warnings.push(
          `Modul "${sortedModules[i].title}" memiliki urutan ${current}, seharusnya ${expected}`
        );
      }
    }
    return warnings;
  }, [sortedModules]);

  const handleDelete = async () => {
    if (!showDelete || !instructorId) return;
    try {
      const res = await fetch(
        `/api/instructor/modules/${showDelete.id}?instructorId=${instructorId}`,
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

  const getKindColor = (kind: string) => {
    switch (kind) {
      case "materi":
        return "blue";
      case "quiz":
        return "grape";
      case "tugas":
        return "orange";
      case "live":
        return "pink";
      default:
        return "gray";
    }
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
                onClick={() => router.push("/instructor/courses")}
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

          <Divider />

          {/* Course Info Card */}
          <Card withBorder padding="lg" radius="md" shadow="sm">
            <Grid>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconBook size="1rem" />
                    <Text size="sm" fw={500}>
                      Kategori
                    </Text>
                  </Group>
                  <Badge variant="light" color="blue" size="lg">
                    {course.category || "-"}
                  </Badge>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconClock size="1rem" />
                    <Text size="sm" fw={500}>
                      Durasi
                    </Text>
                  </Group>
                  <Text size="sm">{toHrs(course.duration_min)}</Text>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconUser size="1rem" />
                    <Text size="sm" fw={500}>
                      Level
                    </Text>
                  </Group>
                  <Badge variant="light" color="cyan">
                    {levelLabels[course.level || ""] || course.level || "-"}
                  </Badge>
                </Stack>
              </Grid.Col>
              <Grid.Col span={12}>
                <Divider my="sm" />
                <Text size="sm" fw={500} mb="xs">
                  Deskripsi
                </Text>
                <Text size="sm" c="dimmed">
                  {course.description || "-"}
                </Text>
              </Grid.Col>
            </Grid>
          </Card>

          <Divider />

          {/* Modules Section */}
          <Group justify="space-between" align="center">
            <div>
              <Title order={3}>Modul Kursus</Title>
              <Text c="dimmed" size="sm">
                {modules.length} modul
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size="1rem" />}
              onClick={() =>
                router.push(`/instructor/courses/${courseId}/modules/new`)
              }
            >
              Tambah Modul
            </Button>
          </Group>

          {/* Order Warnings */}
          {orderWarnings.length > 0 && (
            <Alert
              color="yellow"
              title="Peringatan Urutan Modul"
              icon={<IconAlertTriangle size="1rem" />}
            >
              <Stack gap="xs">
                {orderWarnings.map((warning, idx) => (
                  <Text key={idx} size="sm">
                    • {warning}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          {/* Module List */}
          <Stack gap="md">
            {sortedModules.length === 0 && (
              <Paper withBorder p="xl" radius="md">
                <Text ta="center" c="dimmed">
                  Belum ada modul. Klik tombol Tambah Modul untuk membuat modul
                  pertama.
                </Text>
              </Paper>
            )}
            {sortedModules.map((mod) => {
              const hasOrderIssue =
                mod.order_index !==
                sortedModules.findIndex((m) => m.id === mod.id) + 1;
              return (
                <Card
                  key={mod.id}
                  withBorder
                  padding="lg"
                  radius="md"
                  shadow="sm"
                  style={{
                    borderLeft: hasOrderIssue
                      ? "4px solid var(--mantine-color-yellow-5)"
                      : undefined,
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Group align="flex-start" gap="lg">
                      {/* Order Badge */}
                      <Badge
                        size="xl"
                        variant="filled"
                        color={hasOrderIssue ? "yellow" : "blue"}
                        style={{ minWidth: 40 }}
                      >
                        {mod.order_index || 0}
                      </Badge>

                      {/* Content */}
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Text fw={600} size="lg">
                            {mod.title}
                          </Text>
                          <Badge
                            variant="light"
                            color={getKindColor(mod.module_kind)}
                          >
                            {kindLabels[mod.module_kind] || mod.module_kind}
                          </Badge>
                          {mod.is_published ? (
                            <Badge variant="light" color="green" size="sm">
                              Dipublikasikan
                            </Badge>
                          ) : (
                            <Badge variant="light" color="gray" size="sm">
                              Draft
                            </Badge>
                          )}
                        </Group>
                        {mod.description && (
                          <Text size="sm" c="dimmed" lineClamp={2}>
                            {mod.description}
                          </Text>
                        )}
                      </Stack>
                    </Group>

                    {/* Actions */}
                    <Group gap="xs">
                      <Tooltip label="Edit Modul">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="lg"
                          onClick={() =>
                            router.push(
                              `/instructor/courses/${courseId}/modules/${mod.id}/edit`
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
                          onClick={() => setShowDelete(mod)}
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
        </Stack>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!showDelete}
        onClose={() => setShowDelete(null)}
        title="Konfirmasi Hapus"
        centered
      >
        <Stack gap="md">
          <Text>
            Apakah Anda yakin ingin menghapus modul{" "}
            <strong>{showDelete?.title}</strong>?
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowDelete(null)}>
              Batal
            </Button>
            <Button color="red" onClick={handleDelete}>
              Hapus
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
