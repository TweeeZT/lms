"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Avatar,
  Card,
  Button,
  Anchor,
  Badge,
  Divider,
  Loader,
} from "@mantine/core";
import Link from "next/link";
import { IconChevronLeft } from "@tabler/icons-react";
import { useAuth } from "../../../../../hooks/useAuth";

type Submission = {
  submission_id: string;
  student_id: string;
  assignment_id: string;
  module_id: string;
  module_title: string;
  file_url: string | null;
  answer_link: string | null;
  text_answer: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
  max_score: number | null;
};

export default function CourseStudentsPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<{ id: string; title: string } | null>(
    null
  );
  const [items, setItems] = useState<
    Array<{ student_id: string; submissions: Submission[] }>
  >([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/instructor/courses/${id}/students?instructorId=${user.id}`
        );
        const data = await res.json();
        if (!res.ok || !data.success)
          throw new Error(data.error || "Gagal memuat");
        setCourse(data.course);
        setItems(data.items);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  if (!user) return notFound();

  const initials = (s: string) => (s ? s[0].toUpperCase() : "?");

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconChevronLeft size="1rem" />}
            component={Link}
            href={`/instructor/courses/${id}`}
          >
            Kembali
          </Button>
          <div>
            <Title order={2}>Siswa & Submissions</Title>
            <Text c="dimmed">Kursus: {course?.title || "-"}</Text>
          </div>
        </Group>

        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : error ? (
          <Card withBorder c="red">
            <Text>{error}</Text>
          </Card>
        ) : items.length === 0 ? (
          <Card withBorder>
            <Text c="dimmed">Belum ada submission tugas.</Text>
          </Card>
        ) : (
          <Stack gap="md">
            {items.map((row) => (
              <Card key={row.student_id} withBorder radius="md" padding="md">
                <Group align="start" justify="space-between">
                  <Group>
                    <Avatar radius="xl">{initials(row.student_id)}</Avatar>
                    <div>
                      <Text fw={600}>Student: {row.student_id}</Text>
                      <Text size="sm" c="dimmed">
                        {row.submissions.length} submission
                        {row.submissions.length > 1 ? "s" : ""}
                      </Text>
                    </div>
                  </Group>
                </Group>
                <Divider my="sm" />
                <Stack gap="xs">
                  {row.submissions.map((s) => (
                    <Group key={s.submission_id} justify="space-between">
                      <div>
                        <Text fw={500}>{s.module_title || "Tugas"}</Text>
                        <Text size="sm" c="dimmed">
                          Terkirim: {new Date(s.submitted_at).toLocaleString()}
                        </Text>
                        <Group gap="xs">
                          {s.file_url && (
                            <Anchor href={s.file_url} target="_blank">
                              File
                            </Anchor>
                          )}
                          {s.answer_link && (
                            <Anchor href={s.answer_link} target="_blank">
                              Link
                            </Anchor>
                          )}
                          {s.text_answer && <Badge variant="light">Teks</Badge>}
                        </Group>
                      </div>
                      <div>
                        {s.grade != null ? (
                          <Badge color="green">
                            Nilai: {s.grade}
                            {s.max_score ? `/${s.max_score}` : ""}
                          </Badge>
                        ) : (
                          <Badge color="gray">Belum dinilai</Badge>
                        )}
                      </div>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
