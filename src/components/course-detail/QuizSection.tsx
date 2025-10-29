"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Alert,
  Modal,
  Progress,
  Badge,
  Divider,
  Box,
  Paper,
} from "@mantine/core";
import {
  IconListCheck,
  IconClock,
  IconAlertCircle,
  IconTrophy,
  IconCheck,
  IconX,
  IconHistory,
} from "@tabler/icons-react";
import { QuizHistoryModal } from "./QuizHistoryModal";

type QuizQuestion = {
  id: string;
  question: string;
  q_type: string;
  options: string[];
};

interface QuizSectionProps {
  quiz: {
    id: string;
    title: string;
    passingScore?: number | null;
    timeLimit?: number | null;
    questions: QuizQuestion[];
  };
  attempt?: {
    passed?: boolean;
    score?: number;
    correct?: number;
    correct_count?: number;
    total?: number;
    total_questions?: number;
  } | null;
  attemptAnswers?: {
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation?: string;
  }[];
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  onRetry?: () => void;
  userId?: string;
}

export default function QuizSection({
  quiz,
  attempt,
  attemptAnswers,
  onSubmit,
  onRetry,
  userId,
}: QuizSectionProps) {
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyAttempts, setHistoryAttempts] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch quiz history on mount
  useEffect(() => {
    if (quiz.id && userId) {
      fetchHistory();
    }
  }, [quiz.id, userId]);

  const fetchHistory = async () => {
    if (!userId || !quiz.id) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/user/quiz-history/${quiz.id}?userId=${userId}`
      );
      const json = await res.json();
      if (json.success && json.attempts) {
        setHistoryAttempts(json.attempts);
      }
    } catch (err) {
      console.error("Failed to fetch quiz history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (started && quiz.timeLimit && timeLeft === null) {
      setTimeLeft(quiz.timeLimit * 60);
    }
  }, [started, quiz.timeLimit, timeLeft]);

  useEffect(() => {
    if (started && timeLeft !== null && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && !finished) {
      handleSubmit();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [started, timeLeft, finished]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    setWarningOpen(true);
  };

  const confirmStart = () => {
    setWarningOpen(false);
    setStarted(true);
    setFinished(false);
    setAnswers({});
    if (quiz.timeLimit) {
      setTimeLeft(quiz.timeLimit * 60);
    }
  };

  const handleSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await onSubmit(answers);
      setFinished(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      // Reload page to show results
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz.questions.length;
  const allAnswered = answeredCount === totalQuestions;

  // Show result if attempt exists
  if (attempt) {
    const passed = attempt.passed ?? false;
    const score = attempt.score ?? 0;
    const correct = attempt.correct ?? attempt.correct_count ?? 0;
    const total = attempt.total ?? attempt.total_questions ?? totalQuestions;

    return (
      <>
        <Card withBorder p="lg" radius="md">
          <Stack gap="lg">
            <Group justify="space-between">
              <Group gap="sm">
                <IconTrophy size={32} color={passed ? "#10b981" : "#ef4444"} />
                <div>
                  <Text size="xl" fw={700}>
                    {passed ? "🎉 Selamat!" : "📝 Belum Lulus"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {passed
                      ? "Anda telah lulus quiz ini"
                      : "Nilai Anda belum mencapai passing score"}
                  </Text>
                </div>
              </Group>
              <Badge
                size="xl"
                color={passed ? "green" : "red"}
                variant="filled"
              >
                Skor: {score}%
              </Badge>
            </Group>

            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Benar: {correct} dari {total}
                </Text>
                <Text size="sm" fw={500} c={passed ? "green" : "red"}>
                  Passing Score: {quiz.passingScore || 70}%
                </Text>
              </Group>
              <Progress
                value={score}
                size="xl"
                radius="xl"
                color={passed ? "green" : "red"}
              />
            </div>

            <Group justify="space-between">
              <Button
                onClick={() => setHistoryModalOpen(true)}
                variant="subtle"
                color="gray"
                leftSection={<IconHistory size={16} />}
              >
                Riwayat Quiz
              </Button>
              <Group>
                <Button
                  onClick={() => setResultModalOpen(true)}
                  variant="light"
                  color="blue"
                >
                  Lihat Detail Jawaban
                </Button>
                {onRetry && (
                  <Button onClick={onRetry} color="blue" variant="filled">
                    Coba Lagi
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>
        </Card>

        {/* Result Details Modal */}
        <Modal
          opened={resultModalOpen}
          onClose={() => setResultModalOpen(false)}
          title="Detail Jawaban Quiz"
          size="xl"
          centered
        >
          <Stack gap="md">
            {attemptAnswers && attemptAnswers.length > 0 ? (
              attemptAnswers.map((ans, idx) => {
                // Format answers for display
                const formatAnswer = (answer: string) => {
                  if (answer === "True" || answer === "true") return "Benar";
                  if (answer === "False" || answer === "false") return "Salah";
                  return answer;
                };

                const userAnswerDisplay = formatAnswer(ans.userAnswer);
                const correctAnswerDisplay = formatAnswer(ans.correctAnswer);

                return (
                  <Card key={ans.questionId} withBorder p="md">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          Soal {idx + 1}
                        </Text>
                        {ans.isCorrect ? (
                          <Badge
                            color="green"
                            leftSection={<IconCheck size={12} />}
                          >
                            Benar
                          </Badge>
                        ) : (
                          <Badge color="red" leftSection={<IconX size={12} />}>
                            Salah
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm">{ans.question}</Text>
                      <Divider />
                      <Box
                        p="xs"
                        style={{
                          background: ans.isCorrect ? "#d1fae5" : "#fee2e2",
                          borderRadius: 6,
                        }}
                      >
                        <Text size="xs" c="dimmed" mb={4}>
                          Jawaban Anda:
                        </Text>
                        <Text
                          size="sm"
                          fw={500}
                          c={ans.isCorrect ? "green.8" : "red.8"}
                        >
                          {userAnswerDisplay}
                        </Text>
                      </Box>
                      {!ans.isCorrect && (
                        <Box
                          p="xs"
                          style={{ background: "#d1fae5", borderRadius: 6 }}
                        >
                          <Text size="xs" c="dimmed" mb={4}>
                            Jawaban Benar:
                          </Text>
                          <Text size="sm" fw={500} c="green.8">
                            {correctAnswerDisplay}
                          </Text>
                        </Box>
                      )}
                      {ans.explanation && (
                        <Alert color="blue" p="xs">
                          <Text size="xs">
                            <strong>Penjelasan:</strong> {ans.explanation}
                          </Text>
                        </Alert>
                      )}
                    </Stack>
                  </Card>
                );
              })
            ) : (
              <Text c="dimmed">Tidak ada detail jawaban tersedia</Text>
            )}
          </Stack>
        </Modal>

        {/* Quiz History Modal (opened via Riwayat or Lihat Detail) */}
        <QuizHistoryModal
          opened={historyModalOpen || !!selectedAttempt}
          onClose={() => {
            setSelectedAttempt(null);
            setHistoryModalOpen(false);
          }}
          quizId={quiz.id}
          userId={userId || ""}
          initialAttempt={selectedAttempt}
        />
      </>
    );
  }

  // Not started yet
  if (!started) {
    return (
      <>
        <Card withBorder p="lg" radius="md">
          <Stack gap="lg">
            <Group gap="sm">
              <IconListCheck size={28} color="var(--primary-color)" />
              <div>
                <Text size="xl" fw={700}>
                  {quiz.title}
                </Text>
                <Text size="sm" c="dimmed">
                  Siap untuk mengerjakan quiz?
                </Text>
              </div>
            </Group>

            <Stack gap="sm">
              <Group gap="md">
                <Badge variant="light" size="lg">
                  {totalQuestions} Soal
                </Badge>
                {quiz.timeLimit && (
                  <Badge variant="light" color="orange" size="lg">
                    <Group gap={4}>
                      <IconClock size={14} />
                      {quiz.timeLimit} Menit
                    </Group>
                  </Badge>
                )}
                <Badge variant="light" color="green" size="lg">
                  Passing Score: {quiz.passingScore || 70}%
                </Badge>
              </Group>

              <Alert icon={<IconAlertCircle size={16} />} color="blue">
                <Text size="sm">
                  • Jawab semua pertanyaan sebelum submit
                  <br />• Tidak bisa kembali setelah submit
                  {quiz.timeLimit && (
                    <>
                      <br />• Quiz akan otomatis ter-submit jika waktu habis
                    </>
                  )}
                </Text>
              </Alert>
            </Stack>

            <Group grow>
              <Button onClick={handleStart} size="lg" flex={1}>
                Mulai Quiz
              </Button>
            </Group>

            {/* Riwayat Quiz History */}
            {historyAttempts.length > 0 && (
              <>
                <Divider
                  my="md"
                  label="Riwayat Percobaan"
                  labelPosition="center"
                />
                <Stack gap="sm">
                  {historyAttempts.map((attempt, idx) => (
                    <Paper key={attempt.id} withBorder p="md" radius="md">
                      <Group justify="space-between" wrap="nowrap">
                        <div style={{ flex: 1 }}>
                          <Group gap="xs" mb={4}>
                            <Badge
                              size="sm"
                              color={attempt.passed ? "green" : "red"}
                              leftSection={
                                attempt.passed ? (
                                  <IconCheck size={12} />
                                ) : (
                                  <IconX size={12} />
                                )
                              }
                            >
                              {attempt.passed ? "Lulus" : "Tidak Lulus"}
                            </Badge>
                            <Badge size="sm" variant="light" color="blue">
                              Skor: {attempt.score}%
                            </Badge>
                            <Badge size="sm" variant="light" color="gray">
                              {attempt.correct_count}/{attempt.total_questions}{" "}
                              Benar
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {new Date(attempt.created_at).toLocaleString(
                              "id-ID",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }
                            )}
                          </Text>
                        </div>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setSelectedAttempt(attempt)}
                        >
                          Lihat Detail
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </Card>

        {/* Warning Modal */}
        <Modal
          opened={warningOpen}
          onClose={() => setWarningOpen(false)}
          title="⚠️ Peringatan Penting"
          centered
        >
          <Stack gap="md">
            <Alert color="red" icon={<IconAlertCircle />}>
              <Text size="sm" fw={500}>
                Jika Anda memuat ulang (refresh) halaman saat mengerjakan quiz,
                maka quiz akan direset dan Anda harus mengulang dari awal!
              </Text>
            </Alert>
            <Text size="sm">
              Pastikan koneksi internet Anda stabil dan jangan menutup atau
              refresh halaman sampai selesai mengerjakan quiz.
            </Text>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setWarningOpen(false)}>
                Batal
              </Button>
              <Button onClick={confirmStart} color="blue">
                Saya Mengerti, Mulai Quiz
              </Button>
            </Group>
          </Stack>
        </Modal>
        {/* Quiz History Modal for detail from Riwayat list */}
        <QuizHistoryModal
          opened={!!selectedAttempt}
          onClose={() => setSelectedAttempt(null)}
          quizId={quiz.id}
          userId={userId || ""}
          initialAttempt={selectedAttempt}
        />
      </>
    );
  }

  // Quiz in progress
  return (
    <>
      <Card withBorder p="lg" radius="md">
        <Stack gap="lg">
          {/* Header with timer */}
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={700}>
                {quiz.title}
              </Text>
              <Text size="sm" c="dimmed">
                Jawab {answeredCount}/{totalQuestions} soal
              </Text>
            </div>
            {timeLeft !== null && (
              <Badge
                size="xl"
                color={timeLeft < 60 ? "red" : "blue"}
                variant="filled"
              >
                <Group gap={4}>
                  <IconClock size={18} />
                  {formatTime(timeLeft)}
                </Group>
              </Badge>
            )}
          </Group>

          {/* Progress */}
          <div>
            <Progress
              value={(answeredCount / totalQuestions) * 100}
              size="md"
              radius="xl"
              color="var(--primary-color)"
            />
          </div>

          {/* Questions */}
          <Stack gap="md">
            {quiz.questions.map((q, idx) => (
              <Card key={q.id} withBorder p="md" radius="md" bg="#fafafa">
                <Stack gap="sm">
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <div
                      style={{
                        background: "var(--primary-color)",
                        color: "#fff",
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <Text fw={500} size="sm" style={{ flex: 1 }}>
                      {q.question}
                    </Text>
                  </Group>

                  {/* True/False */}
                  {q.q_type === "true-false" && (
                    <Stack gap={6}>
                      {[
                        { value: "True", label: "Benar" },
                        { value: "False", label: "Salah" },
                      ].map((opt, optIdx) => {
                        const selected = answers[q.id] === opt.value;
                        return (
                          <Button
                            key={opt.value}
                            variant={selected ? "filled" : "light"}
                            size="sm"
                            onClick={() => setAnswer(q.id, opt.value)}
                            style={{
                              justifyContent: "flex-start",
                              paddingLeft: 42,
                              position: "relative",
                              backgroundColor: selected
                                ? "var(--mantine-color-primary-filled)"
                                : undefined,
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                left: 12,
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                background: selected
                                  ? "var(--secondary-color)"
                                  : "#e5e7eb",
                                color: "#000",
                                fontWeight: 600,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            {opt.label}
                          </Button>
                        );
                      })}
                    </Stack>
                  )}

                  {/* Multiple Choice */}
                  {q.q_type === "multiple-choice" && (
                    <Stack gap={6}>
                      {q.options
                        .filter((opt) => opt && opt.trim() !== "")
                        .map((opt, optIdx) => {
                          const selected = answers[q.id] === opt;
                          return (
                            <Button
                              key={optIdx}
                              variant={selected ? "filled" : "light"}
                              size="sm"
                              onClick={() => setAnswer(q.id, opt)}
                              style={{
                                justifyContent: "flex-start",
                                paddingLeft: 42,
                                position: "relative",
                                backgroundColor: selected
                                  ? "var(--mantine-color-primary-filled)"
                                  : undefined,
                              }}
                            >
                              <span
                                style={{
                                  position: "absolute",
                                  left: 12,
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: selected
                                    ? "var(--secondary-color)"
                                    : "#e5e7eb",
                                  color: "#000",
                                  fontWeight: 600,
                                  fontSize: 12,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              {opt}
                            </Button>
                          );
                        })}
                    </Stack>
                  )}

                  {/* Short Answer */}
                  {q.q_type === "short-answer" && (
                    <input
                      type="text"
                      placeholder="Tulis jawaban..."
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      style={{
                        width: "100%",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 14,
                      }}
                    />
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>

          {/* Submit */}
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!allAnswered || submitting}
            size="lg"
            fullWidth
            color="green"
          >
            {allAnswered
              ? "Submit Jawaban"
              : `Jawab ${totalQuestions - answeredCount} Soal Lagi`}
          </Button>
        </Stack>
      </Card>

      {/* Confirm Modal */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Konfirmasi Submit"
        centered
      >
        <Stack gap="md">
          <Text>
            Anda yakin ingin submit jawaban? Anda tidak bisa mengubah jawaban
            setelah submit.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={submitting} color="green">
              Ya, Submit
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Quiz History Modal - Detail Attempt */}
      <QuizHistoryModal
        opened={!!selectedAttempt}
        onClose={() => setSelectedAttempt(null)}
        quizId={quiz.id}
        userId={userId || ""}
        initialAttempt={selectedAttempt}
      />
    </>
  );
}
