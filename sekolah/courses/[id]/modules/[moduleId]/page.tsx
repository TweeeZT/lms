"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Container,
  Card,
  Stack,
  Title,
  Text,
  Alert,
  Loader,
  Center,
  Group,
  Badge,
  Button,
  Box,
  Paper,
  ActionIcon,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCircleCheck,
  IconClock,
  IconFileText,
  IconListCheck,
  IconClipboard,
  IconVideo,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { useAuth } from "../../../../../../hooks/useAuth";

// Import modular components
import MaterialContent from "../../../../../../components/course-detail/MaterialContent";
import QuizSection from "../../../../../../components/course-detail/QuizSection";
import AssignmentSection from "../../../../../../components/course-detail/AssignmentSection";

// Types
type QuizQuestionRuntime = {
  id: string;
  question: string;
  q_type: string;
  options: string[];
};

export interface ModuleDetailType {
  module: {
    id: string;
    courseId: string;
    title: string;
    description?: string | null;
    kind?: string | null;
    order?: number | null;
    duration_min?: number | null;
    content?: {
      type?: string | null;
      url?: string | null;
      filePath?: string | null;
      text?: string | null;
    } | null;
    quiz?: {
      id: string;
      title: string;
      passingScore?: number | null;
      timeLimit?: number | null;
      questions: QuizQuestionRuntime[];
    } | null;
    assignment?: {
      id: string;
      instructions?: string | null;
      dueDate?: string | null;
      maxScore?: string | null;
    } | null;
    liveSession?: {
      id: string;
      title?: string | null;
      agenda?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      meetUrl?: string | null;
      joinCode?: string | null;
      start_at?: string | null;
      duration_min?: number | null;
      join_url?: string | null;
      passcode?: string | null;
      status?: string | null;
      recording_url?: string | null;
      time_zone?: string | null;
    } | null;
  };
  progress: { currentModuleId: string | null; completedModules: string[] };
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
}

const MODULE_ICONS = {
  materi: IconFileText,
  quiz: IconListCheck,
  tugas: IconClipboard,
  live: IconVideo,
};

const MODULE_COLORS = {
  materi: "blue",
  quiz: "grape",
  tugas: "orange",
  live: "red",
};

const MODULE_LABELS = {
  materi: "Materi",
  quiz: "Quiz",
  tugas: "Tugas",
  live: "Live Session",
};

export default function ModuleDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string; moduleId: string }>();
  const router = useRouter();
  const courseId = params?.id as string;
  const moduleId = params?.moduleId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModuleDetailType | null>(null);

  // Load module detail
  useEffect(() => {
    if (!user || !moduleId) return;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/user/modules/${moduleId}?userId=${user.id}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal memuat detail modul");
        }
        setDetail(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat detail modul");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [user, moduleId]);

  // Handle completion callbacks
  const handleQuizSubmit = useCallback(
    async (answers: Record<string, string>) => {
      if (!user || !moduleId) return;

      try {
        const formattedAnswers = Object.entries(answers).map(
          ([questionId, answer]) => ({
            questionId,
            answer,
          })
        );

        console.log("Submitting quiz answers:", formattedAnswers);

        const res = await fetch(`/api/user/modules/${moduleId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            courseId,
            action: "submit-quiz",
            answers: formattedAnswers,
          }),
        });
        const json = await res.json();

        console.log("Quiz submission response:", json);

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal submit quiz");
        }

        // Show notification
        notifications.show({
          title: json.passed ? "Quiz Selesai!" : "Quiz Selesai",
          message: json.passed
            ? `Selamat! Anda lulus dengan skor ${json.score || 0}`
            : `Skor Anda: ${
                json.score || 0
              }. Anda belum mencapai passing score.`,
          color: json.passed ? "green" : "yellow",
        });

        // Reload the detail to show attempt results
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error("Quiz submission error:", err);
        notifications.show({
          title: "Error",
          message: err instanceof Error ? err.message : "Gagal submit quiz",
          color: "red",
        });
      }
    },
    [user, moduleId, courseId]
  );

  const handleQuizRetry = useCallback(async () => {
    if (!user || !moduleId || !courseId) return;

    try {
      // Call API to delete previous attempt
      const res = await fetch(`/api/user/modules/${moduleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          courseId,
          action: "reset-quiz",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal reset quiz");
      }

      notifications.show({
        title: "Quiz Di-reset",
        message: "Silakan coba lagi!",
        color: "blue",
      });

      // Reload to start fresh quiz
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error("Quiz retry error:", err);
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "Gagal reset quiz",
        color: "red",
      });
    }
  }, [user, moduleId, courseId]);

  const handleAssignmentSubmit = useCallback(
    async (fileUrl: string | null, linkUrl: string | null) => {
      if (!user || !moduleId || !courseId) return;

      try {
        const res = await fetch(`/api/user/modules/${moduleId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            courseId,
            action: "submit-assignment",
            fileUrl,
            linkUrl,
          }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          notifications.show({
            title: "Tugas Terkirim!",
            message: "Tugas Anda telah berhasil dikirim.",
            color: "green",
          });
          setTimeout(() => {
            router.push(`/user/courses/${courseId}`);
          }, 1500);
        } else {
          throw new Error(json.error || "Gagal submit tugas");
        }
      } catch (err) {
        notifications.show({
          title: "Error",
          message: err instanceof Error ? err.message : "Gagal submit tugas",
          color: "red",
        });
        throw err;
      }
    },
    [user, moduleId, courseId, router]
  );

  const handleQuizComplete = useCallback(
    (passed: boolean) => {
      if (passed) {
        notifications.show({
          title: "Quiz Selesai!",
          message: "Selamat! Anda telah menyelesaikan quiz ini.",
          color: "green",
        });
        setTimeout(() => {
          router.push(`/user/courses/${courseId}`);
        }, 1500);
      }
    },
    [courseId, router]
  );

  const handleAssignmentComplete = useCallback(() => {
    notifications.show({
      title: "Tugas Terkirim!",
      message: "Tugas Anda telah berhasil dikirim.",
      color: "green",
    });
    setTimeout(() => {
      router.push(`/user/courses/${courseId}`);
    }, 1500);
  }, [courseId, router]);

  const handleMaterialComplete = useCallback(async () => {
    if (!user || !moduleId || !courseId) return;

    try {
      const res = await fetch(`/api/user/modules/${moduleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          courseId,
          action: "auto-complete",
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          title: "Modul Selesai!",
          message: "Modul berhasil diselesaikan!",
          color: "green",
        });
        setTimeout(() => {
          router.push(`/user/courses/${courseId}`);
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to mark complete:", err);
    }
  }, [user, moduleId, courseId, router]);

  // Handle live session complete
  const handleLiveComplete = useCallback(async () => {
    if (!user || !moduleId || !courseId) return;

    try {
      const res = await fetch(`/api/user/modules/${moduleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          courseId,
          action: "auto-complete",
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          title: "Live Session Selesai!",
          message: "Live session berhasil diselesaikan!",
          color: "green",
        });
        // Reload page to show updated completion status
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(json.error || "Gagal menandai selesai");
      }
    } catch (err) {
      console.error("Failed to mark complete:", err);
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "Gagal menandai selesai",
        color: "red",
      });
    }
  }, [user, moduleId, courseId]);

  if (!user) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!detail) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle />} title="Error" color="red">
          Data modul tidak ditemukan
        </Alert>
      </Container>
    );
  }

  const moduleData = detail.module;
  const Icon =
    MODULE_ICONS[moduleData.kind as keyof typeof MODULE_ICONS] || IconFileText;
  const color =
    MODULE_COLORS[moduleData.kind as keyof typeof MODULE_COLORS] || "blue";
  const label =
    MODULE_LABELS[moduleData.kind as keyof typeof MODULE_LABELS] || "Modul";

  const isCompleted = detail.progress.completedModules.includes(moduleId);

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Back Button */}
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={20} />}
          onClick={() => router.push(`/user/courses/${courseId}`)}
        >
          Kembali ke Kursus
        </Button>

        {/* Module Header */}
        <Paper withBorder p="xl" radius="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Group gap="md">
                <Box
                  style={{
                    background: `var(--mantine-color-${color}-light)`,
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <Icon size={32} color={`var(--mantine-color-${color}-6)`} />
                </Box>
                <div>
                  <Group gap="xs" mb={4}>
                    <Badge color={color} variant="light">
                      {label}
                    </Badge>
                    {isCompleted && (
                      <Badge
                        color="green"
                        variant="filled"
                        leftSection={<IconCircleCheck size={14} />}
                      >
                        Selesai
                      </Badge>
                    )}
                  </Group>
                  <Title order={2}>{moduleData.title}</Title>
                  {moduleData.description && (
                    <Text c="dimmed" size="sm" mt="xs">
                      {moduleData.description}
                    </Text>
                  )}
                </div>
              </Group>

              {moduleData.duration_min && (
                <Group gap={4}>
                  <IconClock size={16} />
                  <Text size="sm" c="dimmed">
                    {moduleData.duration_min} menit
                  </Text>
                </Group>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Module Content */}
        <Card withBorder p="xl" radius="lg">
          {/* MATERI */}
          {moduleData.kind === "materi" && moduleData.content && (
            <MaterialContent
              content={moduleData.content}
              onAutoComplete={handleMaterialComplete}
            />
          )}

          {/* QUIZ */}
          {moduleData.kind === "quiz" && moduleData.quiz && (
            <QuizSection
              quiz={moduleData.quiz}
              attempt={detail.attempt}
              attemptAnswers={detail.attemptAnswers}
              onSubmit={handleQuizSubmit}
              onRetry={handleQuizRetry}
            />
          )}

          {/* TUGAS */}
          {moduleData.kind === "tugas" && moduleData.assignment && (
            <AssignmentSection
              assignment={moduleData.assignment}
              onSubmit={handleAssignmentSubmit}
              isSubmitted={isCompleted}
            />
          )}

          {/* LIVE SESSION */}
          {moduleData.kind === "live" && moduleData.liveSession && (
            <Stack gap="lg">
              <Group justify="space-between">
                <Group gap="sm">
                  <IconVideo size={28} color="var(--primary-color)" />
                  <div>
                    <Text size="xl" fw={700}>
                      Live Session
                    </Text>
                    <Text size="sm" c="dimmed">
                      Sesi Tatap Muka Online
                    </Text>
                  </div>
                </Group>
                {isCompleted && (
                  <Badge
                    color="green"
                    variant="filled"
                    leftSection={<IconCircleCheck size={14} />}
                  >
                    Selesai
                  </Badge>
                )}
              </Group>

              {/* Session Details Card */}
              <Card withBorder p="md" bg="#fafafa">
                <Stack gap="md">
                  {moduleData.liveSession.agenda && (
                    <Box>
                      <Group gap={6} mb="xs">
                        <IconListCheck size={16} color="var(--primary-color)" />
                        <Text fw={600} size="sm" c="var(--primary-color)">
                          Agenda:
                        </Text>
                      </Group>
                      <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                        {moduleData.liveSession.agenda}
                      </Text>
                    </Box>
                  )}

                  {moduleData.liveSession.start_at && (
                    <Box>
                      <Group gap={6} mb="xs">
                        <IconCalendarEvent
                          size={16}
                          color="var(--primary-color)"
                        />
                        <Text fw={600} size="sm" c="var(--primary-color)">
                          Waktu:
                        </Text>
                      </Group>
                      <Group gap="xs">
                        <IconClock size={16} />
                        <Text size="sm" fw={500}>
                          {new Date(
                            moduleData.liveSession.start_at
                          ).toLocaleString("id-ID", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZoneName: "short",
                          })}
                        </Text>
                      </Group>
                    </Box>
                  )}

                  {moduleData.liveSession.duration_min && (
                    <Box>
                      <Group gap={6} mb="xs">
                        <IconClock size={16} color="var(--primary-color)" />
                        <Text fw={600} size="sm" c="var(--primary-color)">
                          Durasi:
                        </Text>
                      </Group>
                      <Text size="sm">
                        {moduleData.liveSession.duration_min} menit
                      </Text>
                    </Box>
                  )}
                </Stack>
              </Card>

              <Divider />

              {/* Status-based Actions */}
              {moduleData.liveSession.status === "scheduled" && (
                <>
                  <Alert color="blue" icon={<IconCalendarEvent size={18} />}>
                    <Text size="sm" fw={500}>
                      Live session ini dijadwalkan pada waktu yang telah
                      ditentukan. Pastikan Anda bergabung tepat waktu!
                    </Text>
                  </Alert>

                  {moduleData.liveSession.start_at && (
                    <Button
                      size="md"
                      variant="light"
                      color="blue"
                      component="a"
                      href={(() => {
                        const startDate = new Date(
                          moduleData.liveSession!.start_at!
                        );
                        const endDate = new Date(
                          startDate.getTime() +
                            (moduleData.liveSession!.duration_min || 60) * 60000
                        );
                        const formatDate = (date: Date) =>
                          date.toISOString().replace(/-|:|\.\d\d\d/g, "");
                        const params = new URLSearchParams({
                          action: "TEMPLATE",
                          text: moduleData.title || "Live Session",
                          dates: `${formatDate(startDate)}/${formatDate(
                            endDate
                          )}`,
                          details: `${
                            moduleData.liveSession?.agenda || ""
                          }\n\nJoin URL: ${
                            moduleData.liveSession?.join_url || ""
                          }\nPasscode: ${
                            moduleData.liveSession?.passcode || ""
                          }`,
                          location: moduleData.liveSession?.join_url || "",
                          ctz:
                            moduleData.liveSession?.time_zone || "Asia/Jakarta",
                        });
                        return `https://calendar.google.com/calendar/render?${params.toString()}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      leftSection={<IconCalendarEvent size={20} />}
                    >
                      Tambahkan ke Google Calendar
                    </Button>
                  )}

                  {moduleData.liveSession.join_url && (
                    <Card withBorder p="md" style={{ background: "#f0f9ff" }}>
                      <Stack gap="sm">
                        <Text size="sm" fw={600} c="blue">
                          Link Meeting:
                        </Text>
                        <Group gap="xs" wrap="nowrap">
                          <Button
                            component="a"
                            href={moduleData.liveSession.join_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="light"
                            color="blue"
                            size="sm"
                            style={{ flex: 1 }}
                            leftSection={<IconVideo size={16} />}
                          >
                            Buka Link
                          </Button>
                          <Button
                            variant="outline"
                            color="blue"
                            size="sm"
                            leftSection={<IconClipboard size={16} />}
                            onClick={() => {
                              navigator.clipboard.writeText(
                                moduleData.liveSession!.join_url!
                              );
                              notifications.show({
                                title: "Tersalin!",
                                message: "Link meeting berhasil disalin",
                                color: "blue",
                              });
                            }}
                          >
                            Salin
                          </Button>
                        </Group>
                        {moduleData.liveSession.passcode && (
                          <Group gap="xs">
                            <Text size="sm" c="dimmed">
                              Passcode:
                            </Text>
                            <Text
                              size="sm"
                              fw={700}
                              c="blue"
                              style={{ fontFamily: "monospace" }}
                            >
                              {moduleData.liveSession.passcode}
                            </Text>
                          </Group>
                        )}
                      </Stack>
                    </Card>
                  )}
                </>
              )}

              {moduleData.liveSession.status === "live" &&
                moduleData.liveSession.join_url && (
                  <>
                    <Alert color="red" icon={<IconVideo size={18} />}>
                      <Text size="sm" fw={500}>
                        Sesi live sedang berlangsung. Klik tombol di bawah untuk
                        bergabung sekarang!
                      </Text>
                    </Alert>

                    <Button
                      size="xl"
                      fullWidth
                      color="red"
                      component="a"
                      href={moduleData.liveSession.join_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      leftSection={<IconVideo size={24} />}
                      variant="filled"
                      style={{
                        background:
                          "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      }}
                    >
                      Gabung Live Session Sekarang
                    </Button>

                    {moduleData.liveSession.passcode && (
                      <Card withBorder p="md" style={{ background: "#fef2f2" }}>
                        <Text size="sm" ta="center">
                          <Text component="span" size="sm" c="dimmed">
                            Passcode Meeting:{" "}
                          </Text>
                          <Text
                            component="span"
                            fw={700}
                            size="lg"
                            c="red"
                            style={{ fontFamily: "monospace" }}
                          >
                            {moduleData.liveSession.passcode}
                          </Text>
                        </Text>
                      </Card>
                    )}
                  </>
                )}

              {moduleData.liveSession.status === "ended" && (
                <>
                  <Alert color="green" icon={<IconCircleCheck size={18} />}>
                    <Text size="sm" fw={500}>
                      Live session ini telah selesai.
                      {moduleData.liveSession.recording_url
                        ? " Anda dapat menonton rekamannya."
                        : " Rekaman akan tersedia segera."}
                    </Text>
                  </Alert>

                  {moduleData.liveSession.recording_url && (
                    <Button
                      size="lg"
                      fullWidth
                      color="blue"
                      component="a"
                      href={moduleData.liveSession.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      leftSection={<IconVideo size={20} />}
                    >
                      Tonton Rekaman
                    </Button>
                  )}
                </>
              )}

              {!isCompleted &&
                (() => {
                  // Calculate if session has ended
                  const now = new Date();
                  const startDate = moduleData.liveSession.start_at
                    ? new Date(moduleData.liveSession.start_at)
                    : null;
                  const durationMin = moduleData.liveSession.duration_min || 60;
                  const endDate = startDate
                    ? new Date(startDate.getTime() + durationMin * 60000)
                    : null;
                  const hasEnded = endDate ? now >= endDate : false;

                  return (
                    <>
                      <Divider />
                      <Button
                        size="md"
                        fullWidth
                        color="green"
                        onClick={handleLiveComplete}
                        disabled={!hasEnded}
                        leftSection={<IconCircleCheck size={20} />}
                      >
                        {hasEnded
                          ? "Tandai Selesai"
                          : "Tandai Selesai (Menunggu sesi berakhir)"}
                      </Button>
                      {!hasEnded && (
                        <Text size="xs" c="dimmed" ta="center">
                          Button akan aktif setelah sesi berakhir pada{" "}
                          {endDate?.toLocaleString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          WIB
                        </Text>
                      )}
                    </>
                  );
                })()}
            </Stack>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
