"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
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
  Modal,
  Text as MText,
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
  link_url: string | null;
  score: number | null;
  note: string | null;
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
    Array<{
      student_id: string;
      student_name?: string;
      submissions: Submission[];
    }>
  >([]);
  const [grading, setGrading] = useState<
    Record<string, { score: string; note: string; saving?: boolean }>
  >({});
  const [preview, setPreview] = useState<{
    url: string;
    type: string;
    open: boolean;
    title?: string;
  } | null>(null);

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
        <Modal
          opened={!!preview?.open}
          onClose={() => setPreview(null)}
          title={preview?.title || "Preview File"}
          size="xl"
          centered
        >
          {preview?.url ? (
            preview.type === "pdf" ? (
              <iframe
                src={preview.url}
                style={{ width: "100%", height: 600, border: 0 }}
                title="PDF Preview"
              />
            ) : preview.type.startsWith("image") ? (
              <div
                style={{
                  maxWidth: "100%",
                  maxHeight: 600,
                  position: "relative",
                }}
              >
                <Image
                  src={preview.url}
                  alt="Preview"
                  width={1200}
                  height={800}
                  style={{
                    objectFit: "contain",
                    width: "100%",
                    height: "auto",
                    borderRadius: 8,
                  }}
                  unoptimized
                  priority
                />
              </div>
            ) : preview.type.startsWith("video") ? (
              <video
                src={preview.url}
                style={{ width: "100%", maxHeight: 600 }}
                controls
              />
            ) : (
              <Anchor
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka File
              </Anchor>
            )
          ) : (
            <MText size="sm" c="dimmed">
              Tidak ada file.
            </MText>
          )}
          {preview?.url && (
            <Group mt="md" gap="xs">
              <Button
                component="a"
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                size="xs"
                variant="outline"
              >
                Unduh File
              </Button>
              {preview.type === "pdf" && (
                <Button
                  component="a"
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  variant="light"
                >
                  Buka di Tab Baru
                </Button>
              )}
            </Group>
          )}
        </Modal>
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
                      <Text fw={600}>
                        Siswa: {row.student_name || row.student_id}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {row.submissions.length} pengiriman
                      </Text>
                    </div>
                  </Group>
                </Group>
                <Divider my="sm" />
                <Stack gap="xs">
                  {row.submissions.map((s) => {
                    const gState = grading[s.submission_id] || {
                      score: s.score?.toString() || "",
                      note: s.note || "",
                    };
                    return (
                      <Card
                        key={s.submission_id}
                        withBorder
                        padding="sm"
                        radius="md"
                      >
                        <Group
                          justify="space-between"
                          align="flex-start"
                          wrap="nowrap"
                        >
                          <div style={{ flex: 1, minWidth: 240 }}>
                            <Text fw={500}>{s.module_title || "Tugas"}</Text>
                            <Text size="xs" c="dimmed" mb={4}>
                              Terkirim:{" "}
                              {new Date(s.submitted_at).toLocaleString("id-ID")}
                            </Text>
                            <Group gap="xs" mb={6}>
                              {s.file_url && (
                                <Group gap={4} wrap="nowrap">
                                  <Anchor
                                    href={s.file_url}
                                    target="_blank"
                                    size="xs"
                                  >
                                    Unduh
                                  </Anchor>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    onClick={() => {
                                      const fileUrl = s.file_url; // extra safety for TS
                                      if (!fileUrl) return;
                                      const lower = fileUrl.toLowerCase();
                                      let type = "other";
                                      if (lower.endsWith(".pdf")) type = "pdf";
                                      else if (
                                        /(png|jpg|jpeg|gif|webp)$/.test(lower)
                                      )
                                        type = "image";
                                      else if (/(mp4|mov|mkv|avi)$/.test(lower))
                                        type = "video";
                                      setPreview({
                                        url: fileUrl,
                                        type,
                                        open: true,
                                        title: s.module_title,
                                      });
                                    }}
                                  >
                                    Preview
                                  </Button>
                                </Group>
                              )}
                              {s.link_url && (
                                <Anchor
                                  href={s.link_url}
                                  target="_blank"
                                  size="xs"
                                >
                                  Link
                                </Anchor>
                              )}
                              {s.max_score != null && (
                                <Badge size="xs" variant="light">
                                  Max {s.max_score}
                                </Badge>
                              )}
                            </Group>
                            {s.score != null ? (
                              <Group gap={8} wrap="wrap">
                                <Badge
                                  color={
                                    s.max_score &&
                                    s.score >=
                                      Math.round((s.max_score * 60) / 100)
                                      ? "green"
                                      : "red"
                                  }
                                  variant="filled"
                                >
                                  {s.max_score &&
                                  s.score >=
                                    Math.round((s.max_score * 60) / 100)
                                    ? "Lulus"
                                    : "Belum Lulus"}
                                </Badge>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    // allow override grading -> reveal form by clearing local state
                                    setGrading((prev) => ({
                                      ...prev,
                                      [s.submission_id]: {
                                        score: String(s.score ?? ""),
                                        note: s.note || "",
                                      },
                                    }));
                                    // set score to null locally (UI) to show form
                                    setItems((prev) =>
                                      prev.map((it) => ({
                                        ...it,
                                        submissions: it.submissions.map((sub) =>
                                          sub.submission_id === s.submission_id
                                            ? { ...sub, score: null }
                                            : sub
                                        ),
                                      }))
                                    );
                                  }}
                                >
                                  Override Nilai
                                </Button>
                              </Group>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <input
                                  type="number"
                                  min={0}
                                  max={s.max_score ?? undefined}
                                  placeholder="Skor"
                                  value={gState.score}
                                  style={{
                                    width: 80,
                                    padding: "4px 6px",
                                    border: "1px solid #ccc",
                                    borderRadius: 6,
                                    fontSize: 12,
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) {
                                      setGrading((prev) => ({
                                        ...prev,
                                        [s.submission_id]: {
                                          ...gState,
                                          score: "",
                                        },
                                      }));
                                    } else {
                                      let num = Number(val);
                                      if (
                                        s.max_score != null &&
                                        num > s.max_score
                                      )
                                        num = s.max_score;
                                      if (num < 0) num = 0;
                                      setGrading((prev) => ({
                                        ...prev,
                                        [s.submission_id]: {
                                          ...gState,
                                          score: String(num),
                                        },
                                      }));
                                    }
                                  }}
                                  disabled={gState.saving}
                                />
                                <input
                                  type="text"
                                  placeholder="Catatan (opsional)"
                                  value={gState.note}
                                  style={{
                                    flex: 1,
                                    minWidth: 160,
                                    padding: "4px 6px",
                                    border: "1px solid #ccc",
                                    borderRadius: 6,
                                    fontSize: 12,
                                  }}
                                  onChange={(e) =>
                                    setGrading((prev) => ({
                                      ...prev,
                                      [s.submission_id]: {
                                        ...gState,
                                        note: e.target.value,
                                      },
                                    }))
                                  }
                                  disabled={gState.saving}
                                />
                                <Button
                                  size="xs"
                                  loading={gState.saving}
                                  onClick={async () => {
                                    if (!user) return;
                                    setGrading((prev) => ({
                                      ...prev,
                                      [s.submission_id]: {
                                        ...gState,
                                        saving: true,
                                      },
                                    }));
                                    try {
                                      const numericScore = gState.score
                                        ? Number(gState.score)
                                        : null;
                                      const res = await fetch(
                                        `/api/instructor/courses/${id}/students`,
                                        {
                                          method: "PATCH",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            instructorId: user.id,
                                            submissionId: s.submission_id,
                                            score: numericScore,
                                            note: gState.note || null,
                                            override: s.score != null, // if previously graded
                                          }),
                                        }
                                      );
                                      const js = await res.json();
                                      if (!res.ok || !js.success)
                                        throw new Error(
                                          js.error || "Gagal simpan"
                                        );
                                      // refresh minimal state
                                      setItems((prev) =>
                                        prev.map((it) => ({
                                          ...it,
                                          submissions: it.submissions.map(
                                            (sub) =>
                                              sub.submission_id ===
                                              s.submission_id
                                                ? {
                                                    ...sub,
                                                    score: numericScore,
                                                    note: gState.note || null,
                                                  }
                                                : sub
                                          ),
                                        }))
                                      );
                                    } catch (e) {
                                      console.error(e);
                                    } finally {
                                      setGrading((prev) => ({
                                        ...prev,
                                        [s.submission_id]: {
                                          ...gState,
                                          saving: false,
                                        },
                                      }));
                                    }
                                  }}
                                >
                                  Simpan Nilai
                                </Button>
                              </div>
                            )}
                          </div>
                          <div style={{ minWidth: 110, textAlign: "right" }}>
                            {s.score != null ? (
                              <Badge color="green" variant="filled">
                                {s.score}
                                {s.max_score ? `/${s.max_score}` : ""}
                              </Badge>
                            ) : (
                              <Badge color="gray" variant="light">
                                Menunggu Penilaian
                              </Badge>
                            )}
                          </div>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
