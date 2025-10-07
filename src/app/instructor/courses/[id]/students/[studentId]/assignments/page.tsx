"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Container,
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Card,
  Loader,
  Alert,
  Textarea,
  NumberInput,
  Modal,
  Divider,
  Anchor,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconFileText,
  IconLink,
  IconCheck,
  IconX,
  IconExternalLink,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { notifications } from "@mantine/notifications";

type AssignmentSubmission = {
  submission_id: string;
  module_id: string;
  module_title: string;
  assignment_id: string;
  file_url: string | null;
  link_url: string | null;
  note: string | null;
  submitted_at: string;
  score: number | null;
  max_score: number | null;
  graded: boolean;
};

export default function StudentAssignmentsPage() {
  const { id: courseId, studentId } = useParams<{
    id: string;
    studentId: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [grading, setGrading] = useState(false);
  const [gradeModal, setGradeModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<AssignmentSubmission | null>(null);
  const [score, setScore] = useState<number | "">(0);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!user?.id || !courseId || !studentId) return;
    fetchSubmissions();
  }, [user?.id, courseId, studentId]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/instructor/courses/${courseId}/students/${studentId}/assignments`
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengambil data tugas");
      }

      setStudentName(json.studentName || "");
      setCourseName(json.courseName || "");
      setSubmissions(json.submissions || []);
    } catch (err) {
      console.error("Error fetching submissions:", err);
      notifications.show({
        title: "Error",
        message:
          err instanceof Error ? err.message : "Gagal mengambil data tugas",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const openGradeModal = (submission: AssignmentSubmission) => {
    setSelectedSubmission(submission);
    setScore(submission.score || "");
    setFeedback(submission.note || "");
    setGradeModal(true);
  };

  const handleGrade = async () => {
    if (!selectedSubmission) return;

    try {
      setGrading(true);
      const res = await fetch(`/api/instructor/assignments/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedSubmission.submission_id,
          score: Number(score),
          feedback,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memberikan nilai");
      }

      notifications.show({
        title: "Berhasil!",
        message: "Nilai berhasil diberikan",
        color: "green",
      });

      setGradeModal(false);
      fetchSubmissions();
    } catch (err) {
      console.error("Error grading:", err);
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "Gagal memberikan nilai",
        color: "red",
      });
    } finally {
      setGrading(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() =>
                router.push(`/instructor/courses/${courseId}/students`)
              }
            >
              Kembali
            </Button>
            <div>
              <Title order={2}>Tugas Siswa</Title>
              <Text size="sm" c="dimmed">
                {studentName} - {courseName}
              </Text>
            </div>
          </Group>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : submissions.length === 0 ? (
          <Alert color="blue" title="Tidak ada tugas">
            Siswa belum mengumpulkan tugas apapun
          </Alert>
        ) : (
          <Stack gap="md">
            {submissions.map((submission) => (
              <Card key={submission.submission_id} withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Text fw={600} size="lg">
                        {submission.module_title}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Dikumpulkan:{" "}
                        {new Date(submission.submitted_at).toLocaleString(
                          "id-ID"
                        )}
                      </Text>
                    </div>
                    {submission.graded ? (
                      <Badge
                        color="green"
                        size="lg"
                        leftSection={<IconCheck size={14} />}
                      >
                        Dinilai: {submission.score}/
                        {submission.max_score || 100}
                      </Badge>
                    ) : (
                      <Badge color="yellow" size="lg">
                        Belum Dinilai
                      </Badge>
                    )}
                  </Group>

                  <Divider />

                  <Stack gap="sm">
                    {submission.file_url && (
                      <Group>
                        <IconFileText size={20} />
                        <Anchor
                          href={submission.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Lihat File
                          <IconExternalLink
                            size={14}
                            style={{ marginLeft: 4 }}
                          />
                        </Anchor>
                      </Group>
                    )}

                    {submission.link_url && (
                      <Group>
                        <IconLink size={20} />
                        <Anchor
                          href={submission.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {submission.link_url}
                          <IconExternalLink
                            size={14}
                            style={{ marginLeft: 4 }}
                          />
                        </Anchor>
                      </Group>
                    )}

                    {submission.note && (
                      <Paper withBorder p="sm" bg="#f8f9fa">
                        <Text size="sm" fw={500} mb={4}>
                          Catatan Siswa:
                        </Text>
                        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                          {submission.note}
                        </Text>
                      </Paper>
                    )}
                  </Stack>

                  {submission.graded && submission.note && (
                    <Paper withBorder p="sm" bg="#f0f9ff">
                      <Text size="sm" fw={500} mb={4} c="blue">
                        Feedback Instruktur:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {submission.note}
                      </Text>
                    </Paper>
                  )}

                  <Button
                    onClick={() => openGradeModal(submission)}
                    variant={submission.graded ? "light" : "filled"}
                  >
                    {submission.graded ? "Edit Nilai" : "Beri Nilai"}
                  </Button>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      {/* Grade Modal */}
      <Modal
        opened={gradeModal}
        onClose={() => setGradeModal(false)}
        title={<Text fw={600}>Beri Nilai</Text>}
        size="md"
      >
        <Stack gap="md">
          <NumberInput
            label="Nilai"
            placeholder="Masukkan nilai"
            value={score}
            onChange={(val) => setScore(typeof val === "number" ? val : "")}
            min={0}
            max={selectedSubmission?.max_score || 100}
            description={`Maksimal: ${selectedSubmission?.max_score || 100}`}
            required
          />

          <Textarea
            label="Feedback (Opsional)"
            placeholder="Berikan feedback untuk siswa..."
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            minRows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setGradeModal(false)}>
              Batal
            </Button>
            <Button
              onClick={handleGrade}
              loading={grading}
              disabled={score === "" || Number(score) < 0}
            >
              Simpan Nilai
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
