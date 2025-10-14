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
  Modal,
  Textarea,
  NumberInput,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import {
  IconChevronLeft,
  IconFileText,
  IconLink,
  IconEye,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconClock,
} from "@tabler/icons-react";
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
  status: string | null;
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

  // State untuk modal grading/reject
  const [gradingModal, setGradingModal] = useState<{
    open: boolean;
    submission: Submission | null;
    mode: "grade" | "reject";
  }>({ open: false, submission: null, mode: "grade" });
  const [modalScore, setModalScore] = useState<number | "">("");
  const [modalNote, setModalNote] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  const openGradeModal = (submission: Submission) => {
    setGradingModal({ open: true, submission, mode: "grade" });
    setModalScore(submission.score || "");
    setModalNote(submission.note || "");
  };

  const openRejectModal = (submission: Submission) => {
    setGradingModal({ open: true, submission, mode: "reject" });
    setModalScore("");
    setModalNote(submission.note || "");
  };

  const closeModal = () => {
    setGradingModal({ open: false, submission: null, mode: "grade" });
    setModalScore("");
    setModalNote("");
  };

  const handleSubmitGrade = async () => {
    const { submission, mode } = gradingModal;
    if (!submission || !user) return;

    if (mode === "reject" && !modalNote.trim()) {
      notifications.show({
        title: "Catatan Wajib",
        message: "Catatan harus diisi saat menolak tugas",
        color: "red",
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }

    if (mode === "grade" && modalScore === "") {
      notifications.show({
        title: "Nilai Wajib",
        message: "Nilai harus diisi saat memberi penilaian",
        color: "red",
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }

    setSavingGrade(true);
    try {
      const res = await fetch(`/api/instructor/courses/${id}/students`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: user.id,
          submissionId: submission.submission_id,
          score: mode === "grade" ? Number(modalScore) : null,
          note: modalNote || null,
          action: mode,
          override: submission.status === "graded",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
            `Gagal ${mode === "reject" ? "menolak" : "menyimpan nilai"}`
        );
      }

      // Update local state
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          submissions: item.submissions.map((sub) =>
            sub.submission_id === submission.submission_id
              ? {
                  ...sub,
                  score: mode === "grade" ? Number(modalScore) : null,
                  note: modalNote || null,
                  status: mode === "reject" ? "rejected" : "graded",
                }
              : sub
          ),
        }))
      );

      notifications.show({
        title: mode === "reject" ? "Tugas Ditolak" : "Nilai Disimpan",
        message:
          mode === "reject"
            ? "Tugas berhasil ditolak. Siswa dapat submit ulang."
            : "Penilaian berhasil disimpan.",
        color: mode === "reject" ? "orange" : "green",
        icon: mode === "reject" ? <IconX size={18} /> : <IconCheck size={18} />,
      });

      closeModal();
    } catch (e) {
      notifications.show({
        title: "Error",
        message: e instanceof Error ? e.message : "Terjadi kesalahan",
        color: "red",
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSavingGrade(false);
    }
  };

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
        notifications.show({
          title: "Error",
          message: msg || "Gagal memuat data",
          color: "red",
          icon: <IconAlertCircle size={18} />,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  if (!user) return notFound();

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

  const initials = (s: string) => (s ? s[0].toUpperCase() : "?");

  return (
    <Container size="lg" p="sm">
      <Stack gap="md">
        {/* Modal Grading/Reject */}
        <Modal
          opened={gradingModal.open}
          onClose={closeModal}
          title={
            <Text size="md" fw={700} c="var(--primary-color)">
              {gradingModal.mode === "reject"
                ? "❌ Tolak Tugas"
                : "✅ Beri Nilai"}
            </Text>
          }
          size="sm"
          centered
        >
          <Stack gap="sm">
            {gradingModal.submission && (
              <Alert color="blue" variant="light">
                <Text size="xs" fw={600}>
                  Modul: {gradingModal.submission.module_title}
                </Text>
                <Text size="xs" c="dimmed">
                  Dikirim:{" "}
                  {new Date(
                    gradingModal.submission.submitted_at
                  ).toLocaleString("id-ID")}
                </Text>
              </Alert>
            )}

            {gradingModal.mode === "grade" && (
              <NumberInput
                label="Nilai"
                placeholder="Masukkan nilai"
                value={modalScore}
                onChange={(value) => {
                  if (typeof value === "number") {
                    setModalScore(value);
                  } else if (value === "") {
                    setModalScore("");
                  }
                }}
                min={0}
                max={gradingModal.submission?.max_score || 100}
                required
                size="sm"
              />
            )}

            <Textarea
              label={
                gradingModal.mode === "reject"
                  ? "Catatan (Wajib)"
                  : "Catatan (Opsional)"
              }
              placeholder={
                gradingModal.mode === "reject"
                  ? "Jelaskan apa yang perlu diperbaiki..."
                  : "Tambahkan catatan untuk siswa..."
              }
              value={modalNote}
              onChange={(e) => setModalNote(e.currentTarget.value)}
              minRows={3}
              required={gradingModal.mode === "reject"}
              size="sm"
            />

            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" onClick={closeModal} size="sm">
                Batal
              </Button>
              <Button
                onClick={handleSubmitGrade}
                loading={savingGrade}
                color={gradingModal.mode === "reject" ? "red" : "green"}
                size="sm"
                leftSection={
                  gradingModal.mode === "reject" ? (
                    <IconX size={16} />
                  ) : (
                    <IconCheck size={16} />
                  )
                }
              >
                {gradingModal.mode === "reject"
                  ? "Tolak Tugas"
                  : "Simpan Nilai"}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal Preview File */}
        <Modal
          opened={!!preview?.open}
          onClose={() => setPreview(null)}
          title={
            <Text size="md" fw={700}>
              {preview?.title || "Preview File"}
            </Text>
          }
          size="lg"
          centered
        >
          {preview?.url ? (
            preview.type === "pdf" ? (
              <iframe
                src={preview.url}
                style={{
                  width: "100%",
                  height: 600,
                  border: 0,
                  borderRadius: 8,
                }}
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
                style={{ width: "100%", maxHeight: 600, borderRadius: 8 }}
                controls
              />
            ) : (
              <Anchor
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                size="md"
              >
                Buka File
              </Anchor>
            )
          ) : (
            <Text size="md" c="dimmed">
              Tidak ada file.
            </Text>
          )}
          {preview?.url && (
            <Group mt="md" gap="sm">
              <Button
                component="a"
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                size="sm"
                variant="outline"
                leftSection={<IconFileText size={16} />}
              >
                Unduh File
              </Button>
            </Group>
          )}
        </Modal>

        {/* Header */}
        <Group justify="space-between" wrap="wrap">
          <div>
            <Button
              variant="subtle"
              leftSection={<IconChevronLeft size={20} />}
              component={Link}
              href={`/instructor/courses/${id}`}
              size="md"
            >
              Kembali
            </Button>
            <Title order={1} mt="sm" c="var(--primary-color)">
              Pengumpulan Tugas Siswa
            </Title>
            <Text size="lg" c="dimmed" mt={4}>
              Kursus: {course?.title || "-"}
            </Text>
          </div>
        </Group>

        {error && (
          <Alert color="red" title="Error" icon={<IconAlertCircle />}>
            <Text size="md">{error}</Text>
          </Alert>
        )}

        {!error && items.length === 0 && (
          <Card withBorder shadow="sm" p="md" radius="md">
            <Stack align="center" gap="sm">
              <IconAlertCircle size={40} color="gray" />
              <Text size="sm" c="dimmed" ta="center">
                Belum ada pengumpulan tugas dari siswa.
              </Text>
            </Stack>
          </Card>
        )}

        {!error && items.length > 0 && (
          <Stack gap="md">
            {items.map((row) => (
              <Card
                key={row.student_id}
                withBorder
                shadow="sm"
                radius="md"
                p="md"
              >
                <Group justify="space-between" wrap="wrap" mb="sm">
                  <Group gap="xs">
                    <Avatar
                      size="md"
                      radius="xl"
                      styles={{
                        root: {
                          background: "var(--gradient-primary)",
                          color: "white",
                          fontSize: 16,
                          fontWeight: 700,
                        },
                      }}
                    >
                      {initials(row.student_name || row.student_id)}
                    </Avatar>
                    <div>
                      <Text size="md" fw={700} c="var(--primary-color)">
                        {row.student_name || row.student_id}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {row.submissions.length} Pengumpulan Tugas
                      </Text>
                    </div>
                  </Group>
                </Group>

                <Divider my="sm" />

                <Stack gap="sm">
                  {row.submissions.map((s) => (
                    <Card
                      key={s.submission_id}
                      withBorder
                      p="sm"
                      radius="md"
                      style={{ background: "white" }}
                    >
                      <Stack gap="sm">
                        {/* Header Submission */}
                        <Group justify="space-between" wrap="wrap">
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={700} c="var(--primary-color)">
                              {s.module_title || "Tugas"}
                            </Text>
                            <Text size="xs" c="dimmed" mt={2}>
                              Dikirim:{" "}
                              {new Date(s.submitted_at).toLocaleString(
                                "id-ID",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }
                              )}
                            </Text>
                          </div>

                          {/* Status Badge */}
                          <Badge
                            size="md"
                            variant="light"
                            color={
                              s.status === "waiting"
                                ? "yellow"
                                : s.status === "rejected"
                                ? "red"
                                : "green"
                            }
                            leftSection={
                              s.status === "waiting" ? (
                                <IconClock size={14} />
                              ) : s.status === "rejected" ? (
                                <IconX size={14} />
                              ) : (
                                <IconCheck size={14} />
                              )
                            }
                          >
                            {s.status === "waiting" && "Menunggu"}
                            {s.status === "rejected" && "Ditolak"}
                            {s.status === "graded" && "Dinilai"}
                          </Badge>
                        </Group>

                        {/* File/Link Info */}
                        <Group gap="xs" wrap="wrap">
                          {s.file_url && (
                            <Button
                              variant="light"
                              color="blue"
                              size="xs"
                              leftSection={<IconFileText size={14} />}
                              onClick={() => {
                                const fileUrl = s.file_url!;
                                console.log(
                                  "File URL from submission:",
                                  fileUrl
                                );
                                const lower = fileUrl.toLowerCase();
                                let type = "other";
                                if (lower.endsWith(".pdf")) type = "pdf";
                                else if (/(png|jpg|jpeg|gif|webp)$/.test(lower))
                                  type = "image";
                                else if (/(mp4|mov|mkv|avi)$/.test(lower))
                                  type = "video";
                                console.log("Detected file type:", type);
                                setPreview({
                                  url: fileUrl,
                                  type,
                                  open: true,
                                  title: s.module_title,
                                });
                              }}
                            >
                              Lihat File
                            </Button>
                          )}
                          {s.link_url && (
                            <Button
                              component="a"
                              href={s.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="light"
                              color="cyan"
                              size="xs"
                              leftSection={<IconLink size={14} />}
                            >
                              Buka Link
                            </Button>
                          )}
                          {s.max_score != null && (
                            <Badge size="sm" variant="outline" color="gray">
                              Maks: {s.max_score}
                            </Badge>
                          )}
                        </Group>

                        {/* Catatan Instruktur (jika ada) */}
                        {s.note && (
                          <Alert
                            color="orange"
                            variant="light"
                            title="📝 Catatan"
                          >
                            <Text size="xs">{s.note}</Text>
                          </Alert>
                        )}

                        {/* Action Buttons */}
                        <Divider />
                        <Group justify="space-between" wrap="wrap">
                          <Group gap="xs">
                            {s.status === "graded" ? (
                              <>
                                <Badge size="md" color="green" variant="filled">
                                  Nilai: {s.score}/{s.max_score || 100}
                                </Badge>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  color="blue"
                                  onClick={() => openGradeModal(s)}
                                >
                                  Ubah Nilai
                                </Button>
                              </>
                            ) : s.status === "rejected" ? (
                              <Badge size="md" color="red" variant="light">
                                Ditolak - Menunggu Submit Ulang
                              </Badge>
                            ) : (
                              <Badge size="md" color="yellow" variant="light">
                                Menunggu Penilaian
                              </Badge>
                            )}
                          </Group>

                          {s.status !== "rejected" && (
                            <Group gap="xs">
                              {s.status === "waiting" && (
                                <>
                                  <Button
                                    size="xs"
                                    color="green"
                                    leftSection={<IconCheck size={14} />}
                                    onClick={() => openGradeModal(s)}
                                  >
                                    Beri Nilai
                                  </Button>
                                  <Button
                                    size="xs"
                                    color="red"
                                    variant="outline"
                                    leftSection={<IconX size={14} />}
                                    onClick={() => openRejectModal(s)}
                                  >
                                    Tolak
                                  </Button>
                                </>
                              )}
                            </Group>
                          )}
                        </Group>
                      </Stack>
                    </Card>
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
