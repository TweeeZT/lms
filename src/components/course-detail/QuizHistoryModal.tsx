"use client";

import {
  Modal,
  Stack,
  Text,
  Badge,
  Accordion,
  Timeline,
  Group,
  Paper,
  Loader,
  Alert,
} from "@mantine/core";
import { IconCheck, IconX, IconClockHour4 } from "@tabler/icons-react";
import { useEffect, useState } from "react";

interface QuizAttempt {
  id: string;
  score: number;
  correct_count: number;
  total_questions: number;
  passed: boolean;
  created_at: string;
  enrichedAnswers: EnrichedAnswer[];
}

interface EnrichedAnswer {
  questionId: string;
  questionText: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

interface QuizHistoryModalProps {
  opened: boolean;
  onClose: () => void;
  quizId: string;
  userId: string;
  initialAttempt?: any; // If provided, show only this attempt expanded
}

export function QuizHistoryModal({
  opened,
  onClose,
  quizId,
  userId,
  initialAttempt,
}: QuizHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [error, setError] = useState("");

  // If initialAttempt provided, use it directly
  useEffect(() => {
    if (initialAttempt) {
      setAttempts([initialAttempt]);
      setQuizTitle(initialAttempt.quiz?.title || "Quiz");
      return;
    }

    if (opened && quizId && userId) {
      fetchHistory();
    }
  }, [opened, quizId, userId, initialAttempt]);

  const fetchHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/user/quiz-history/${quizId}?userId=${userId}`
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat riwayat quiz");
      }

      setAttempts(json.attempts || []);
      setQuizTitle(json.quiz?.title || "Quiz");
    } catch (err: any) {
      console.error("Error fetching quiz history:", err);
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text size="lg" fw={700}>
          Riwayat Quiz: {quizTitle}
        </Text>
      }
      size="xl"
      padding="lg"
    >
      {loading && (
        <Stack align="center" py="xl">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Memuat riwayat...
          </Text>
        </Stack>
      )}

      {error && (
        <Alert color="red" title="Error" mb="md">
          {error}
        </Alert>
      )}

      {!loading && !error && attempts.length === 0 && (
        <Alert color="blue" title="Info">
          Belum ada riwayat percobaan quiz ini.
        </Alert>
      )}

      {!loading && !error && attempts.length > 0 && (
        <Accordion
          variant="separated"
          chevronPosition="left"
          defaultValue={attempts.length === 1 ? attempts[0].id : undefined}
        >
          {attempts.map((attempt, idx) => (
            <Accordion.Item key={attempt.id} value={attempt.id}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={500}>
                      Percobaan #{attempts.length - idx}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(attempt.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Badge
                      color={attempt.passed ? "green" : "red"}
                      leftSection={
                        attempt.passed ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconX size={14} />
                        )
                      }
                    >
                      {attempt.passed ? "Lulus" : "Tidak Lulus"}
                    </Badge>
                    <Badge variant="light" color="blue">
                      Nilai: {attempt.score}
                    </Badge>
                    <Badge variant="light" color="gray">
                      {attempt.correct_count}/{attempt.total_questions}
                    </Badge>
                  </Group>
                </Group>
              </Accordion.Control>

              <Accordion.Panel>
                <Stack gap="md">
                  <Paper withBorder p="sm" bg="gray.0">
                    <Group gap="xs">
                      <IconClockHour4 size={16} />
                      <Text size="sm" fw={500}>
                        Detail Jawaban
                      </Text>
                    </Group>
                  </Paper>

                  <Timeline
                    active={attempt.enrichedAnswers.length}
                    bulletSize={24}
                  >
                    {attempt.enrichedAnswers.map((answer, ansIdx) => {
                      // Parse option to get actual answer text
                      const getUserAnswerText = (
                        userAns: string,
                        opts: string[]
                      ) => {
                        // Check if it's True/False
                        if (userAns === "True" || userAns === "true")
                          return "Benar";
                        if (userAns === "False" || userAns === "false")
                          return "Salah";

                        // Check if it's an index
                        const idx = parseInt(userAns);
                        if (!isNaN(idx) && opts && opts[idx]) {
                          return opts[idx];
                        }

                        return userAns;
                      };

                      const getCorrectAnswerText = (
                        correctAns: string,
                        opts: string[]
                      ) => {
                        // Check if it's True/False
                        if (correctAns === "True" || correctAns === "true")
                          return "Benar";
                        if (correctAns === "False" || correctAns === "false")
                          return "Salah";

                        // Check if it's an index
                        const idx = parseInt(correctAns);
                        if (!isNaN(idx) && opts && opts[idx]) {
                          return opts[idx];
                        }

                        return correctAns;
                      };

                      const userAnswerDisplay = getUserAnswerText(
                        answer.userAnswer,
                        answer.options
                      );
                      const correctAnswerDisplay = getCorrectAnswerText(
                        answer.correctAnswer,
                        answer.options
                      );

                      return (
                        <Timeline.Item
                          key={answer.questionId}
                          bullet={
                            answer.isCorrect ? (
                              <IconCheck size={14} />
                            ) : (
                              <IconX size={14} />
                            )
                          }
                          color={answer.isCorrect ? "green" : "red"}
                          title={
                            <Text size="sm" fw={500}>
                              Soal {ansIdx + 1}
                            </Text>
                          }
                        >
                          <Stack gap="xs" mt="xs">
                            <Text size="sm">{answer.questionText}</Text>

                            {/* Jawaban User - Hijau jika benar, Merah jika salah */}
                            <Paper
                              withBorder
                              p="xs"
                              style={{
                                background: answer.isCorrect
                                  ? "#d1fae5"
                                  : "#fee2e2",
                                borderColor: answer.isCorrect
                                  ? "#10b981"
                                  : "#ef4444",
                              }}
                            >
                              <Text size="xs" c="dimmed" mb={4}>
                                Jawaban Anda:
                              </Text>
                              <Text
                                size="sm"
                                fw={500}
                                c={answer.isCorrect ? "#10b981" : "#ef4444"}
                              >
                                {userAnswerDisplay || "(Tidak dijawab)"}
                              </Text>
                            </Paper>

                            {/* Jawaban Benar - Hanya muncul jika salah */}
                            {!answer.isCorrect && (
                              <Paper
                                withBorder
                                p="xs"
                                style={{
                                  background: "#d1fae5",
                                  borderColor: "#10b981",
                                }}
                              >
                                <Text size="xs" c="dimmed" mb={4}>
                                  Jawaban Benar:
                                </Text>
                                <Text size="sm" fw={500} c="#10b981">
                                  {correctAnswerDisplay}
                                </Text>
                              </Paper>
                            )}

                            {/* Penjelasan */}
                            {answer.explanation && (
                              <Paper withBorder p="xs" bg="gray.0">
                                <Text size="xs" c="dimmed" mb={4}>
                                  Penjelasan:
                                </Text>
                                <Text size="sm">{answer.explanation}</Text>
                              </Paper>
                            )}
                          </Stack>
                        </Timeline.Item>
                      );
                    })}
                  </Timeline>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Modal>
  );
}
