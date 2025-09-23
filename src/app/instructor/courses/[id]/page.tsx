"use client";

import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Badge,
  Grid,
  Table,
  Button,
  Paper,
  Divider,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import Link from "next/link";
import { useAuth } from "../../../../hooks/useAuth";
import {
  IconBook,
  IconClock,
  IconUser,
  IconChevronLeft,
  IconPlus,
  IconPencil,
} from "@tabler/icons-react";

export default function InstructorCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<{
    id: string;
    instructor_id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    category: string;
    price: number | null;
    duration_min: number | null;
    level: string;
    total_modules: number | null;
    enrolled_count: number | null;
    rating: number | null;
    is_published: boolean | null;
    created_at: string;
    updated_at: string;
  } | null>(null);
  const [modules, setModules] = useState<
    Array<{
      id: string;
      course_id: string;
      title: string;
      description: string | null;
      module_kind: "materi" | "quiz" | "tugas";
      order_index: number;
      is_published: boolean | null;
      created_at: string;
      updated_at: string;
    }>
  >([]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [cRes, mRes] = await Promise.all([
          fetch(`/api/instructor/courses/${id}?instructorId=${user.id}`),
          fetch(
            `/api/instructor/courses/${id}/modules?instructorId=${user.id}`
          ),
        ]);
        const cJson = await cRes.json();
        const mJson = await mRes.json();
        if (!cRes.ok || !cJson.success) {
          if (cRes.status === 403 || cRes.status === 404)
            return router.replace("/instructor/courses");
          throw new Error(cJson.error || "Gagal memuat kursus");
        }
        if (!mRes.ok || !mJson.success) {
          throw new Error(mJson.error || "Gagal memuat modul");
        }
        if (!active) return;
        setCourse(cJson.item);
        setModules(mJson.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, user?.id, router]);

  if (!loading && !course) return notFound();

  const toHrs = (min: number | null) => {
    const m = Number(min || 0);
    return `${Math.floor(m / 60)}j ${m % 60}m`;
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconChevronLeft size="1rem" />}
              component={Link}
              href="/instructor/courses"
            >
              Kembali
            </Button>
            <div>
              <Title order={2}>{course?.title || ""}</Title>
              <Text c="dimmed">Detail kursus, materi, dan statistik</Text>
            </div>
          </Group>
          <Badge
            variant="light"
            color={course?.is_published ? "green" : "gray"}
          >
            {course?.is_published ? "Published" : "Draft"}
          </Badge>
        </Group>

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card padding="lg" radius="md">
              <Stack gap="sm">
                <Text>{course?.description}</Text>
                <Group gap="md">
                  <Group gap={6}>
                    <IconBook size="1rem" />
                    <Text size="sm">{course?.total_modules || 0} modul</Text>
                  </Group>
                  <Group gap={6}>
                    <IconClock size="1rem" />
                    <Text size="sm">{toHrs(course?.duration_min || 0)}</Text>
                  </Group>
                  <Group gap={6}>
                    <IconUser size="1rem" />
                    <Text size="sm">{course?.enrolled_count || 0} siswa</Text>
                  </Group>
                </Group>

                {/* Tombol Lihat Siswa */}
                <Button
                  mt="md"
                  component={Link}
                  href={`/instructor/courses/${id}/students`}
                >
                  Lihat Siswa
                </Button>
              </Stack>
            </Card>

            <Card padding="lg" radius="md" mt="lg">
              <Group justify="space-between" mb="sm">
                <Title order={4}>Daftar Modul</Title>

                {/* Tombol Tambah Modul */}
                <Button
                  size="sm"
                  leftSection={<IconPlus size="1rem" />}
                  component={Link}
                  href={`/instructor/courses/${id}/modules/new`}
                >
                  Tambah Modul
                </Button>
              </Group>

              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Judul</Table.Th>
                    <Table.Th>Jenis</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {modules.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>{m.order_index}</Table.Td>
                      <Table.Td>
                        <Text fw={600}>{m.title}</Text>
                        <Text size="xs" c="dimmed">
                          {m.description}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{m.module_kind}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={m.is_published ? "green" : "gray"}
                          variant="light"
                        >
                          {m.is_published ? "Published" : "Draft"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Edit Modul">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            component={Link}
                            href={`/instructor/courses/${id}/modules/${m.id}/edit`}
                          >
                            <IconPencil size="1rem" />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
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
                      (course?.category || "scratch") === "scratch"
                        ? "orange"
                        : "cyan"
                    }
                  >
                    {course?.category}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Level
                  </Text>
                  <Badge variant="light">{course?.level}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Harga
                  </Text>
                  <Text fw={700}>
                    Rp {(course?.price || 0).toLocaleString()}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Rating
                  </Text>
                  <Text fw={600}>{course?.rating ?? 0}/5</Text>
                </Group>
                <Divider my="sm" />
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Dibuat
                  </Text>
                  <Text size="sm">
                    {course
                      ? new Date(course.created_at).toLocaleDateString("id-ID")
                      : ""}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Diperbarui
                  </Text>
                  <Text size="sm">
                    {course
                      ? new Date(course.updated_at).toLocaleDateString("id-ID")
                      : ""}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
