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
  IconUsers,
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
      [...modules].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      }),
    [modules]
  );

  // No order warnings since order_index doesn't exist

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
    <Container size="xl" pb="xl">
      {error && (
        <Alert color="red" mb="md" title="Error">
          {error}
        </Alert>
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
            <Group>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconUsers size={18} />}
                onClick={() =>
                  router.push(`/instructor/courses/${courseId}/students`)
                }
              >
                Lihat Siswa
              </Button>
              <Badge
                variant="light"
                color={course.is_published ? "green" : "gray"}
              >
                {course.is_published ? "Dipublikasikan" : "Draft"}
              </Badge>
            </Group>
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
            {sortedModules.map((mod, index) => {
              return (
                <Card
                  key={mod.id}
                  withBorder
                  padding="lg"
                  radius="md"
                  shadow="sm"
                >
                  <Group justify="space-between" align="flex-start">
                    <Group align="flex-start" gap="lg">
                      {/* Order Badge */}
                      <Badge
                        size="xl"
                        variant="filled"
                        color="blue"
                        style={{ minWidth: 40 }}
                      >
                        {index + 1}
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
