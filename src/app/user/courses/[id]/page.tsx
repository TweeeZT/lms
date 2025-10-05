"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Container,
  Grid,
  Card,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Alert,
  Loader,
  Modal,
  Stepper,
  Menu,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCircleCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
  IconListCheck,
  IconClipboard,
  IconCalendarPlus,
  IconPhoto,
  IconPuzzle,
  IconRefresh,
} from "@tabler/icons-react";
import Image from "next/image";
import { useAuth } from "../../../../hooks/useAuth";

// Shared types (extracted for cross-component usage)
type ModuleListItem = {
  id: string;
  title: string;
  kind: string;
  order: number;
  isCompleted: boolean;
};
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
      created_at?: string;
      updated_at?: string;
      // Extended fields from module_live_sessions
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

export default function CourseDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModuleDetailType | null>(null);
  const [posting, setPosting] = useState(false);
  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTimeLeft, setQuizTimeLeft] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    passed: boolean;
    score: number;
    correct: number;
    total: number;
  } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [completionSuccess, setCompletionSuccess] = useState(false);
  // Certificate state
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  // Rating gating state
  const [userRating, setUserRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  // New: track course completion to always show rating UI after completion
  const [courseCompleted, setCourseCompleted] = useState(false);
  // Assignment state
  const [assignFile, setAssignFile] = useState<File | null>(null);
  const [assignLink, setAssignLink] = useState("");
  const [assignUploading, setAssignUploading] = useState(false);
  const [assignSubmitted, setAssignSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCompletedRef = useRef(false);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  // load modules list + current
  useEffect(() => {
    const run = async () => {
      if (!user || !courseId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/user/courses/${courseId}/modules?userId=${user.id}`
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat modul");
        setModules(json.items as ModuleListItem[]);
        setCurrentId(json.currentModuleId || json.items?.[0]?.id || null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gagal memuat modul";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user, courseId]);

  // load current module detail
  useEffect(() => {
    const run = async () => {
      if (!user || !currentId) return;
      setDetail(null);
      // reset quiz state when switching modules
      setQuizStarted(false);
      setQuizFinished(false);
      setQuizTimeLeft(null);
      setQuizAnswers({});
      try {
        const res = await fetch(
          `/api/user/modules/${currentId}?userId=${user.id}`
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat detail modul");
        setDetail(json);
        // If there's an existing attempt, show its result (persist after reload)
        if (json.attempt && json.module?.quiz) {
          setQuizResult({
            passed: !!json.attempt.passed,
            score: json.attempt.score ?? 0,
            correct: json.attempt.correct ?? json.attempt.correct_count ?? 0,
            total:
              json.attempt.total ??
              json.attempt.total_questions ??
              (json.module.quiz.questions?.length || 0),
          });
          setQuizFinished(true);
          setQuizStarted(false);
        }
      } catch {
        // noop error UI below
      }
    };
    run();
  }, [user, currentId]);

  const markCompleteAuto = useCallback(async () => {
    if (!user || !currentId) return;
    if (modules.find((m) => m.id === currentId)?.isCompleted) return;
    try {
      const res = await fetch(`/api/user/modules/${currentId}`, {
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
        setModules((prev) =>
          prev.map((m) =>
            m.id === currentId ? { ...m, isCompleted: true } : m
          )
        );
      }
    } catch {}
  }, [user, currentId, courseId, modules, setModules]);

  // Quiz countdown effect
  const submitQuiz = useCallback(async () => {
    if (!detail?.module.quiz || quizFinished) return;
    setQuizFinished(true);
    if (!user) return;
    try {
      const answers = Object.entries(quizAnswers).map(
        ([questionId, answer]) => ({ questionId, answer })
      );
      const res = await fetch(`/api/user/modules/${currentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          courseId,
          action: "submit-quiz",
          answers,
        }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setQuizResult({
          passed: !!json.passed,
          score: json.score ?? 0,
          correct: json.correct ?? 0,
          total: json.total ?? 0,
        });

        // Update detail with attempt results for modal display
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                attempt: {
                  passed: !!json.passed,
                  score: json.score ?? 0,
                  correct: json.correct ?? 0,
                  total: json.total ?? 0,
                },
                attemptAnswers: json.attemptAnswers || [],
              }
            : prev
        );

        if (json.passed) {
          setModules((prev) =>
            prev.map((m) =>
              m.id === currentId ? { ...m, isCompleted: true } : m
            )
          );
          // Re-fetch module list to ensure gating is consistent
          try {
            const listRes = await fetch(
              `/api/user/courses/${courseId}/modules?userId=${user.id}`
            );
            const listJson = await listRes.json();
            if (listRes.ok && listJson.success) {
              setModules(listJson.items);
            }
          } catch {}
        }
      }
    } catch {}
  }, [
    detail?.module.quiz,
    quizFinished,
    user,
    quizAnswers,
    currentId,
    courseId,
    setModules,
  ]);

  useEffect(() => {
    if (!quizStarted || quizFinished) return;
    if (quizTimeLeft == null) return;
    if (quizTimeLeft <= 0) {
      submitQuiz();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setQuizTimeLeft((t) => (t == null ? t : t - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [quizStarted, quizFinished, quizTimeLeft, submitQuiz]);

  // Auto-complete for PDF scroll (simple observer)
  useEffect(() => {
    if (!detail || quizStarted || quizFinished) return;
    if (
      detail.module.content?.type === "file" ||
      /\.pdf($|\?)/i.test(detail.module.content?.url || "")
    ) {
      const el = pdfContainerRef.current;
      if (!el) return;
      const onScroll = () => {
        if (autoCompletedRef.current) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
          autoCompletedRef.current = true;
          markCompleteAuto();
        }
      };
      el.addEventListener("scroll", onScroll);
      return () => el.removeEventListener("scroll", onScroll);
    }
  }, [detail, quizStarted, quizFinished, markCompleteAuto]);

  const index = useMemo(
    () => modules.findIndex((m) => m.id === currentId),
    [modules, currentId]
  );
  const prevId = index > 0 ? modules[index - 1].id : null;
  const nextId =
    index >= 0 && index < modules.length - 1 ? modules[index + 1].id : null;

  // gating: block next unless current is completed
  const canGoNext = useMemo(() => {
    if (!currentId) return false;
    const m = modules.find((x) => x.id === currentId);
    return Boolean(m?.isCompleted);
  }, [modules, currentId]);

  // Compute upcoming live sessions for sidebar
  const upcomingLives = useMemo(() => {
    if (!detail) return [];
    const lives = modules
      .filter((m) => m.kind === "live")
      .map((m) => {
        // Try to get live session data from detail if current module
        if (m.id === currentId && detail.module.liveSession) {
          const live = detail.module.liveSession;
          const rawStart = live.start_at || live.startTime;
          const start = rawStart ? new Date(rawStart) : null;
          const now = new Date();
          if (start && start > now) {
            return { id: m.id, title: m.title, start };
          }
        }
        return null;
      })
      .filter(Boolean) as { id: string; title: string; start: Date }[];
    return lives.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [modules, detail, currentId]);

  // Certificate functions
  const checkCertificate = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      const res = await fetch(
        `/api/user/certificates?userId=${user.id}&courseId=${courseId}`
      );
      const json = await res.json();
      if (res.ok && json.success && json.certificate?.url) {
        setCertificateUrl(json.certificate.url);
      }
    } catch (error) {
      console.error("Error checking certificate:", error);
    }
  }, [user, courseId]);

  const downloadCertificate = async () => {
    if (!user || !courseId) return;
    setDownloadingCertificate(true);
    try {
      // First try to get existing certificate (with sendEmail=true untuk kirim email saat download)
      let certificateResponse = await fetch(
        `/api/user/certificates?userId=${user.id}&courseId=${courseId}&sendEmail=true`
      );
      let json = await certificateResponse.json();

      // If no certificate exists, generate one
      if (!json.success || !json.certificate?.url) {
        certificateResponse = await fetch("/api/user/certificates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            courseId: courseId,
          }),
        });
        json = await certificateResponse.json();
      }

      if (!certificateResponse.ok || !json.success) {
        notifications.show({
          title: "Error",
          message: json.error || "Gagal mengunduh sertifikat",
          color: "red",
        });
        return;
      }

      // Download the certificate
      const url = json.certificateUrl || json.certificate?.url;
      if (url) {
        setCertificateUrl(url);
        // Open in new window for download
        window.open(url, "_blank");

        notifications.show({
          title: "Sertifikat Berhasil Diunduh",
          message:
            "Sertifikat telah berhasil diunduh dan dikirim ke email Anda!",
          color: "green",
        });
      }
    } catch (error) {
      console.error("Error downloading certificate:", error);
      notifications.show({
        title: "Error",
        message: "Terjadi kesalahan saat mengunduh sertifikat",
        color: "red",
      });
    } finally {
      setDownloadingCertificate(false);
    }
  };

  const regenerateCertificate = async () => {
    if (!user || !courseId) return;

    // Konfirmasi dulu
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin membuat ulang sertifikat? Sertifikat lama akan diganti dan email baru akan dikirim."
    );
    if (!confirmed) return;

    setDownloadingCertificate(true);
    try {
      const certificateResponse = await fetch("/api/user/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          courseId: courseId,
        }),
      });
      const json = await certificateResponse.json();

      if (!certificateResponse.ok || !json.success) {
        notifications.show({
          title: "Error",
          message: json.error || "Gagal membuat ulang sertifikat",
          color: "red",
        });
        return;
      }

      // Update certificate URL
      const url = json.certificateUrl;
      if (url) {
        setCertificateUrl(url);
        window.open(url, "_blank");

        notifications.show({
          title: "Sertifikat Berhasil Diperbaharui",
          message: "Sertifikat baru telah dibuat dan dikirim ke email Anda!",
          color: "green",
        });
      }
    } catch (error) {
      console.error("Error regenerating certificate:", error);
      notifications.show({
        title: "Error",
        message: "Terjadi kesalahan saat membuat ulang sertifikat",
        color: "red",
      });
    } finally {
      setDownloadingCertificate(false);
    }
  };

  // Check for certificate when modules change and course is completed
  useEffect(() => {
    const completedCount = modules.filter((m) => m.isCompleted).length;
    const isCompleted = completedCount === modules.length && modules.length > 0;
    setCourseCompleted(isCompleted);
    if (isCompleted) {
      // fetch rating first to decide gating
      if (user) {
        fetch(`/api/user/courses/${courseId}/rating?userId=${user.id}`)
          .then((r) => r.json())
          .then((j) => {
            if (j.success) {
              setUserRating(j.rating ?? null);
              // Always show rating prompt UI after completion (enabled or disabled)
              setShowRatingPrompt(true);
              if (j.rating) checkCertificate();
            }
          })
          .catch(() => {});
      }
    }
  }, [modules, courseId, user, checkCertificate]);

  const submitRating = async (val: number) => {
    if (!user) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/user/courses/${courseId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, rating: val }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUserRating(val);
        setShowRatingPrompt(false);
        // now allow certificate
        checkCertificate();
        notifications.show({
          title: "Terima kasih",
          message: "Rating berhasil disimpan",
          color: "green",
        });
      } else {
        notifications.show({
          title: "Gagal",
          message: json.error || "Tidak bisa menyimpan rating",
          color: "red",
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Terjadi kesalahan jaringan",
        color: "red",
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  // Simple inline rating UI (placeholder) - integrate into existing JSX later
  const RatingPrompt = () => {
    if (!courseCompleted || !showRatingPrompt) return null;
    return (
      <Card withBorder mt="lg" p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Berikan Rating Kursus Ini</Text>
          <Group>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                variant={n <= (userRating || 0) ? "filled" : "light"}
                disabled={submittingRating || !!userRating}
                onClick={() => !userRating && submitRating(n)}
              >
                {n}★
              </Button>
            ))}
          </Group>
          {userRating && (
            <Text size="xm" c="green">
              Rating kamu: {userRating}★ (terima kasih!)
            </Text>
          )}
          {!userRating && (
            <Text size="xs" c="dimmed">
              Klik bintang untuk memberikan rating sebelum mengunduh sertifikat.
            </Text>
          )}
        </Stack>
      </Card>
    );
  };

  // NOTE: Injecting RatingPrompt into layout by monkey-patching React.createElement later would be overkill.
  // The actual component return (far below in file) should include <RatingPrompt /> where certificate button lives.

  const markComplete = async () => {
    if (!user || !currentId) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/user/modules/${currentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          courseId,
          action: "complete",
          nextModuleId: nextId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // basic user feedback (could be replaced with notification component)
        alert(json.error || "Gagal menyelesaikan modul");
        return;
      }

      // Show success alert
      setCompletionSuccess(true);

      // Check if this is course completion (last module)
      const currentModuleIndex = modules.findIndex((m) => m.id === currentId);
      const isLastModule = currentModuleIndex === modules.length - 1;

      if (isLastModule && json.courseCompleted && json.pointsAwarded) {
        // Show course completion success with animated points
        setTimeout(() => {
          notifications.show({
            title: "🎉 Kursus Selesai!",
            message: `Selamat! Anda telah menyelesaikan kursus ini dan mendapat +${
              json.pointsAwarded
            } poin!${
              json.certificateAvailable
                ? " Sertifikat Anda sudah tersedia untuk diunduh."
                : ""
            }`,
            color: "green",
            autoClose: json.certificateAvailable ? 8000 : 5000, // Longer if certificate available
          });

          // Animate points addition (you could add more sophisticated animation here)
          console.log(`Points awarded: +${json.pointsAwarded}`);

          // Optionally refresh user data to show updated points
          // This would require a context or state update mechanism
        }, 1000);
      }

      // Refresh module list from server to ensure gating & progress are consistent
      try {
        const listRes = await fetch(
          `/api/user/courses/${courseId}/modules?userId=${user.id}`
        );
        const listJson = await listRes.json();
        if (listRes.ok && listJson.success) {
          setModules(listJson.items);
        } else {
          // fallback local optimistic update
          setModules((prev) =>
            prev.map((m) =>
              m.id === currentId ? { ...m, isCompleted: true } : m
            )
          );
        }
      } catch {
        setModules((prev) =>
          prev.map((m) =>
            m.id === currentId ? { ...m, isCompleted: true } : m
          )
        );
      }
      if (json.nextModuleId) setCurrentId(json.nextModuleId);
    } catch {
      // could show notification
    } finally {
      setPosting(false);
    }
  };

  // ... Later in the returned JSX we inject <RatingPrompt /> just above certificate actions.

  const startQuiz = () => {
    if (!detail?.module.quiz) return;
    setQuizResult(null);
    setQuizStarted(true);
    const tl = detail.module.quiz.timeLimit || 0;
    setQuizTimeLeft(tl > 0 ? tl * 60 : null); // convert minutes to seconds
  };

  const retryQuiz = () => {
    if (!detail?.module.quiz) return;
    setQuizAnswers({});
    setQuizFinished(false);
    setQuizResult(null);
    setQuizStarted(true);
    const tl = detail.module.quiz.timeLimit || 0;
    setQuizTimeLeft(tl > 0 ? tl * 60 : null);
  };

  const setAnswer = (qid: string, ans: string) => {
    setQuizAnswers((prev) => ({ ...prev, [qid]: ans }));
  };

  if (!user) return null;

  return (
    <Container size="xl">
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Title order={4}>Progres Modul</Title>

              {loading ? (
                <Loader />
              ) : error ? (
                <Alert color="red">{error}</Alert>
              ) : (
                <Stepper
                  orientation="vertical"
                  active={modules.findIndex((m) => m.id === currentId)}
                  onStepClick={(index) => setCurrentId(modules[index].id)}
                  allowNextStepsSelect={false}
                >
                  {modules.map((m) => (
                    <Stepper.Step
                      key={m.id}
                      label={m.title}
                      description={m.kind}
                      icon={
                        m.isCompleted ? (
                          <IconCircleCheck size={16} />
                        ) : undefined
                      }
                    />
                  ))}
                </Stepper>
              )}

              {/* Upcoming Live Sessions */}
              {upcomingLives.length > 0 && (
                <>
                  <Title order={5} mt="md">
                    Live Mendatang
                  </Title>
                  <Stack gap="xs">
                    {upcomingLives.map((live) => (
                      <Badge
                        key={live.id}
                        variant="light"
                        color="orange"
                        size="lg"
                        style={{ cursor: "pointer", textAlign: "left" }}
                        onClick={() => setCurrentId(live.id)}
                      >
                        <div>
                          <Text size="xs" fw={600}>
                            {live.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {live.start.toLocaleDateString("id-ID", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </div>
                      </Badge>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
          <Card radius="md" padding="lg" className="card-hover">
            <Stack gap="md">
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  leftSection={<IconChevronLeft size={16} />}
                  onClick={() => router.push("/user/courses")}
                >
                  Kembali
                </Button>
                <Group gap="xs">
                  <Button
                    variant="light"
                    disabled={!prevId}
                    leftSection={<IconChevronLeft size={16} />}
                    onClick={() => prevId && setCurrentId(prevId)}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    className="btn-primary"
                    disabled={!canGoNext || !nextId}
                    rightSection={<IconChevronRight size={16} />}
                    onClick={() => nextId && setCurrentId(nextId)}
                  >
                    Berikutnya
                  </Button>
                </Group>
              </Group>

              {!detail ? (
                <Group justify="center">
                  <Loader />
                </Group>
              ) : (
                <div>
                  <Title order={3} mb="xs">
                    {detail.module.title}
                  </Title>
                  {detail.module.description && (
                    <Text c="dimmed" mb="md">
                      {detail.module.description}
                    </Text>
                  )}

                  {/* Live Session Panel */}
                  {detail.module.kind === "live" &&
                    detail.module.liveSession && (
                      <LiveSessionPanel
                        live={detail.module.liveSession}
                        userName={user.fullName}
                      />
                    )}

                  {detail.module.kind === "video" ||
                  detail.module.content?.type === "video" ? (
                    <Card withBorder p="md">
                      <Group gap="xs" mb="sm">
                        <IconFileText size={18} />
                        <Text fw={600}>Materi Video</Text>
                      </Group>
                      {(() => {
                        const url = detail.module.content?.url || "";
                        // Extract YouTube video ID from common URL formats
                        const match = url.match(
                          /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,})/
                        );
                        const vid = match?.[1];
                        return vid ? (
                          <div
                            style={{
                              position: "relative",
                              paddingTop: "56.25%",
                              borderRadius: 8,
                              overflow: "hidden",
                            }}
                          >
                            <iframe
                              src={`https://www.youtube.com/embed/${vid}?enablejsapi=1`}
                              title="YouTube video"
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                border: 0,
                              }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              onLoad={() => {
                                // Fallback: auto-complete after 95% of time if duration known? Without API we can't get duration.
                                // Simpler: set a fallback timer (e.g., 5 minutes) if not completed; skip if already.
                                if (!autoCompletedRef.current) {
                                  setTimeout(() => {
                                    if (!autoCompletedRef.current) {
                                      autoCompletedRef.current = true;
                                      markCompleteAuto();
                                    }
                                  }, 5 * 60 * 1000);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {url ||
                              detail.module.content?.filePath ||
                              "Tidak ada URL"}
                          </Text>
                        );
                      })()}
                    </Card>
                  ) : detail.module.kind === "quiz" || detail.module.quiz ? (
                    <Card withBorder p="md">
                      <Group gap="xs">
                        <IconListCheck size={18} />
                        <Text fw={600}>Kuis</Text>
                      </Group>
                      <Text size="sm" c="dimmed" mt="xs">
                        Pertanyaan: {detail.module.quiz?.questions?.length || 0}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Passing score: {detail.module.quiz?.passingScore}
                      </Text>
                      <Modal
                        opened={startConfirmOpen}
                        onClose={() => setStartConfirmOpen(false)}
                        title={<Text fw={600}>Mulai Kuis?</Text>}
                        centered
                      >
                        <Text size="sm" mb="md">
                          Setelah dimulai, timer akan berjalan. Reload atau
                          menutup halaman sebelum klik Selesai akan mengulang
                          kuis dari awal dan jawaban belum tersimpan.
                        </Text>
                        {detail.module.quiz?.timeLimit && (
                          <Alert color="yellow" mb="md">
                            Batas waktu: {detail.module.quiz?.timeLimit} menit.
                          </Alert>
                        )}
                        <Group justify="flex-end" mt="md">
                          <Button
                            variant="default"
                            onClick={() => setStartConfirmOpen(false)}
                          >
                            Batal
                          </Button>
                          <Button
                            className="btn-primary"
                            onClick={() => {
                              setStartConfirmOpen(false);
                              startQuiz();
                            }}
                          >
                            Mulai Sekarang
                          </Button>
                        </Group>
                      </Modal>
                      {!quizStarted && !quizFinished && (
                        <Button
                          mt="md"
                          onClick={() => setStartConfirmOpen(true)}
                          className="btn-primary"
                        >
                          Mulai Kuis
                        </Button>
                      )}
                      {quizStarted && !quizFinished && (
                        <Stack gap="sm" mt="md">
                          {quizTimeLeft != null && (
                            <Text
                              span
                              size="sm"
                              fw={600}
                              c={quizTimeLeft < 30 ? "red" : undefined}
                              style={{
                                background: "var(--secondary-color)",
                                padding: "4px 8px",
                                borderRadius: 6,
                                width: "fit-content",
                                lineHeight: 1.2,
                              }}
                            >
                              Sisa Waktu: {Math.floor(quizTimeLeft / 60)}:
                              {String(quizTimeLeft % 60).padStart(2, "0")}
                            </Text>
                          )}
                          {detail.module.quiz?.questions.map((q, idx) => (
                            <Card key={q.id} withBorder p="sm" radius="md">
                              <Group
                                align="flex-start"
                                gap={8}
                                mb={4}
                                wrap="nowrap"
                              >
                                <div
                                  style={{
                                    background: "var(--primary-color)",
                                    color: "#fff",
                                    width: 28,
                                    height: 28,
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
                                <Text
                                  fw={500}
                                  size="sm"
                                  style={{ lineHeight: 1.4 }}
                                  c="black"
                                  mb={10}
                                >
                                  {q.question}
                                </Text>
                              </Group>
                              {q.q_type === "short-answer" && (
                                <input
                                  style={{
                                    width: "100%",
                                    border: "1px solid #ccc",
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    fontSize: 14,
                                  }}
                                  placeholder="Tulis jawaban..."
                                  value={quizAnswers[q.id] || ""}
                                  onChange={(e) =>
                                    setAnswer(q.id, e.target.value)
                                  }
                                />
                              )}
                              {(q.q_type === "multiple-choice" ||
                                q.q_type === "true-false") && (
                                <Stack gap={4}>
                                  {q.options.map((opt, optIdx) => {
                                    const selected = quizAnswers[q.id] === opt;
                                    const label = String.fromCharCode(
                                      65 + optIdx
                                    );
                                    return (
                                      <Button
                                        key={optIdx}
                                        variant={selected ? "filled" : "light"}
                                        size="sm"
                                        onClick={() => setAnswer(q.id, opt)}
                                        style={{
                                          justifyContent: "flex-start",
                                          position: "relative",
                                          paddingLeft: 42,
                                        }}
                                        color={
                                          selected
                                            ? "var(--primary-color)"
                                            : undefined
                                        }
                                      >
                                        <span
                                          style={{
                                            position: "absolute",
                                            left: 12,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            width: 24,
                                            height: 24,
                                            borderRadius: 6,
                                            background: selected
                                              ? "var(--secondary-color)"
                                              : "var(--hover-bg)",
                                            color: selected ? "#000" : "#333",
                                            fontWeight: 600,
                                            fontSize: 12,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                        >
                                          {label}
                                        </span>
                                        {opt || `Opsi ${optIdx + 1}`}
                                      </Button>
                                    );
                                  })}
                                </Stack>
                              )}
                            </Card>
                          ))}
                          <Group justify="space-between" mt="sm">
                            <Text size="xs" c="dimmed">
                              {Object.keys(quizAnswers).length}/
                              {detail.module.quiz?.questions.length} terjawab
                            </Text>
                            <Button
                              onClick={submitQuiz}
                              disabled={
                                quizFinished ||
                                !detail.module.quiz?.questions.every(
                                  (q) => quizAnswers[q.id]
                                )
                              }
                              color="green"
                            >
                              Selesai Kuis
                            </Button>
                          </Group>
                        </Stack>
                      )}
                      {quizFinished && quizResult && (
                        <Card
                          mt="md"
                          withBorder
                          p="sm"
                          radius="md"
                          style={{ background: "#f8fafc" }}
                        >
                          <Stack gap={6}>
                            <Text size="sm" fw={600}>
                              Kuis selesai.
                            </Text>
                            <Text size="sm">
                              Skor: <strong>{quizResult.score}%</strong> (
                              {quizResult.correct}/{quizResult.total} benar)
                            </Text>
                            <Text
                              size="sm"
                              c={quizResult.passed ? "green" : "red"}
                              fw={600}
                            >
                              {quizResult.passed
                                ? "Selamat! Kamu lulus kuis ini."
                                : "Belum lulus. Pelajari materi dan coba lagi."}
                            </Text>
                            {detail?.attemptAnswers?.length && (
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => setShowReviewModal(true)}
                                style={{ alignSelf: "flex-start" }}
                              >
                                Lihat Kunci & Penjelasan
                              </Button>
                            )}
                            <Group gap="xs" mt={4}>
                              <Button
                                size="xs"
                                variant="light"
                                onClick={retryQuiz}
                                color={quizResult.passed ? "blue" : "orange"}
                              >
                                {quizResult.passed
                                  ? "Coba Lagi"
                                  : "Ulangi Kuis"}
                              </Button>
                            </Group>
                          </Stack>
                        </Card>
                      )}
                    </Card>
                  ) : detail.module.content?.type === "file" ||
                    /\.pdf($|\?)/i.test(detail.module.content?.url || "") ? (
                    <Card
                      withBorder
                      p="md"
                      ref={pdfContainerRef}
                      style={{ maxHeight: 640, overflowY: "auto" }}
                    >
                      <Group gap="xs" mb="sm">
                        <IconFileText size={18} />
                        <Text fw={600}>Materi PDF</Text>
                      </Group>
                      {(() => {
                        const pdfUrl =
                          detail.module.content?.url ||
                          (detail.module.content?.filePath
                            ? `/api/files/${detail.module.content.filePath}`
                            : "");
                        if (!pdfUrl)
                          return (
                            <Text size="sm" c="dimmed">
                              PDF tidak ditemukan
                            </Text>
                          );
                        return (
                          <div
                            style={{
                              border: "1px solid #eee",
                              borderRadius: 8,
                              overflow: "hidden",
                              height: 600,
                            }}
                          >
                            <iframe
                              title="PDF Document"
                              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                              style={{
                                width: "100%",
                                height: "100%",
                                border: 0,
                              }}
                            />
                          </div>
                        );
                      })()}
                      <Text size="xs" mt="xs" c="dimmed">
                        Jika PDF tidak tampil,{" "}
                        <a
                          href={detail.module.content?.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          buka di tab baru
                        </a>
                        .
                      </Text>
                    </Card>
                  ) : detail.module.kind === "assignment" ||
                    detail.module.assignment ? (
                    <Card withBorder p="md">
                      <Group gap="xs">
                        <IconClipboard size={18} />
                        <Text fw={600}>Tugas</Text>
                      </Group>
                      <Text size="sm" c="dimmed" mt="xs">
                        {detail.module.assignment?.instructions}
                      </Text>
                      {detail.module.assignment?.dueDate && (
                        <Alert
                          color="yellow"
                          mt="sm"
                          variant="light"
                          radius="md"
                        >
                          Deadline:{" "}
                          {new Date(
                            detail.module.assignment.dueDate
                          ).toLocaleString("id-ID")}
                        </Alert>
                      )}
                      <Stack gap={8} mt="md">
                        <Text size="sm" fw={500}>
                          Kirim Jawaban
                        </Text>

                        {/* Input File Kustom */}
                        <div
                          onClick={() => {
                            if (assignUploading || assignSubmitted) return;
                            document.getElementById("assignFileInput")?.click();
                          }}
                          style={{
                            border: "2px dashed var(--mantine-color-gray-4)",
                            borderRadius: 12,
                            padding: "18px 16px",
                            textAlign: "center",
                            cursor:
                              assignUploading || assignSubmitted
                                ? "not-allowed"
                                : "pointer",
                            background: assignSubmitted
                              ? "#f0fdf4"
                              : "linear-gradient(135deg,#fafafa,#f5f7fa)",
                            position: "relative",
                            transition: "border-color .2s, background .2s",
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (assignUploading || assignSubmitted) return;
                            e.currentTarget.style.borderColor = "#228be6";
                            e.currentTarget.style.background =
                              "rgba(34,139,230,0.05)";
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            if (assignSubmitted)
                              e.currentTarget.style.background = "#f0fdf4";
                            else
                              e.currentTarget.style.background =
                                "linear-gradient(135deg,#fafafa,#f5f7fa)";
                            e.currentTarget.style.borderColor =
                              "var(--mantine-color-gray-4)";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (assignUploading || assignSubmitted) return;
                            const file = e.dataTransfer.files?.[0];
                            if (file) setAssignFile(file);
                            e.currentTarget.style.borderColor =
                              "var(--mantine-color-gray-4)";
                            e.currentTarget.style.background =
                              "linear-gradient(135deg,#fafafa,#f5f7fa)";
                          }}
                        >
                          <input
                            id="assignFileInput"
                            type="file"
                            hidden
                            disabled={assignUploading || assignSubmitted}
                            onChange={(e) =>
                              setAssignFile(e.target.files?.[0] || null)
                            }
                            accept=".pdf,.zip,.rar,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.mkv"
                          />
                          {!assignFile && !assignSubmitted && (
                            <div>
                              <Text size="sm" fw={600} c="dimmed" mb={4}>
                                Klik / seret & letakkan berkas di sini
                              </Text>
                              <Text size="xs" c="dimmed">
                                Dukungan: PDF, Gambar, ZIP, Dokumen Office,
                                Video
                              </Text>
                            </div>
                          )}
                          {assignFile && !assignSubmitted && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                alignItems: "center",
                              }}
                            >
                              <Text size="sm" fw={600}>
                                {assignFile.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {(assignFile.size / 1024 / 1024).toFixed(2)} MB
                              </Text>
                              {!assignUploading && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="red"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssignFile(null);
                                  }}
                                >
                                  Ganti / Hapus
                                </Button>
                              )}
                              {assignUploading && (
                                <Text size="xs" c="blue">
                                  Mengunggah...
                                </Text>
                              )}
                            </div>
                          )}
                          {assignSubmitted && (
                            <Text size="sm" fw={600} c="green">
                              Berkas terkirim
                            </Text>
                          )}
                          {!assignFile && assignSubmitted && (
                            <Text size="xs" c="dimmed">
                              Pengiriman selesai
                            </Text>
                          )}
                        </div>
                        <Text size="xs" c="dimmed">
                          atau pilih input link dibawah ini
                        </Text>
                        <input
                          type="text"
                          placeholder="Link (opsional, misal: GitHub / Scratch)"
                          value={assignLink}
                          disabled={assignUploading || assignSubmitted}
                          onChange={(e) => setAssignLink(e.target.value)}
                          style={{
                            width: "100%",
                            border: "1px solid #ccc",
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 13,
                          }}
                        />
                        <Group gap={8}>
                          <Button
                            size="xs"
                            loading={assignUploading}
                            disabled={
                              assignSubmitted || (!assignFile && !assignLink)
                            }
                            onClick={async () => {
                              if (!user || !currentId) return;
                              setAssignUploading(true);
                              try {
                                let fileUrl: string | undefined;
                                if (assignFile) {
                                  const fd = new FormData();
                                  fd.append("file", assignFile);
                                  fd.append("userId", user.id);
                                  fd.append(
                                    "bucket",
                                    "assignments-submissions"
                                  );
                                  fd.append("filename", assignFile.name);
                                  const upRes = await fetch(
                                    "/api/storage/upload",
                                    {
                                      method: "POST",
                                      body: fd,
                                    }
                                  );
                                  const upJson = await upRes.json();
                                  if (!upRes.ok || !upJson.success)
                                    throw new Error(
                                      upJson.error || "Upload gagal"
                                    );
                                  fileUrl = upJson.url;
                                }
                                const submitRes = await fetch(
                                  `/api/user/modules/${currentId}`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      userId: user.id,
                                      courseId,
                                      action: "submit-assignment",
                                      fileUrl,
                                      linkUrl: assignLink || undefined,
                                    }),
                                  }
                                );
                                const subJson = await submitRes.json();
                                if (!submitRes.ok || !subJson.success)
                                  throw new Error(
                                    subJson.error || "Gagal submit tugas"
                                  );
                                setAssignSubmitted(true);
                                // refresh modules for progress
                                try {
                                  const listRes = await fetch(
                                    `/api/user/courses/${courseId}/modules?userId=${user.id}`
                                  );
                                  const listJson = await listRes.json();
                                  if (listRes.ok && listJson.success)
                                    setModules(listJson.items);
                                } catch {}
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setAssignUploading(false);
                              }
                            }}
                          >
                            {assignSubmitted ? "Terkirim" : "Kirim"}
                          </Button>
                          {assignSubmitted && (
                            <Text size="xs" c="green">
                              Tugas sudah dikirim.
                            </Text>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          Format diperbolehkan: gambar, pdf, zip, dokumen
                          Office, video (ukuran wajar).
                        </Text>
                      </Stack>
                    </Card>
                  ) : detail.module.kind === "materi" &&
                    (detail.module.content?.type === "text" ||
                      detail.module.content?.text) ? (
                    <Card withBorder p="md">
                      <Group gap="xs" mb="sm">
                        <IconFileText size={18} />
                        <Text fw={600}>Materi Teks</Text>
                      </Group>
                      <Text
                        size="sm"
                        style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
                      >
                        {detail.module.content?.text || "(Kosong)"}
                      </Text>
                    </Card>
                  ) : detail.module.kind === "materi" &&
                    detail.module.content?.type === "link" &&
                    detail.module.content?.url ? (
                    <Card withBorder p="md">
                      <Group gap="xs" mb="sm">
                        <IconFileText size={18} />
                        <Text fw={600}>Materi Link</Text>
                      </Group>
                      <Text size="sm" c="dimmed" mb={4}>
                        Sumber eksternal:
                      </Text>
                      <a
                        href={detail.module.content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--primary-color)",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                          fontSize: 14,
                        }}
                      >
                        {detail.module.content.url}
                      </a>
                    </Card>
                  ) : detail.module.kind === "materi" &&
                    detail.module.content?.type === "image" &&
                    detail.module.content?.url ? (
                    <Card withBorder p="md">
                      <Group gap="xs" mb="sm">
                        <IconPhoto size={18} />
                        <Text fw={600}>Materi Gambar</Text>
                      </Group>
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          minHeight: 400,
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#f5f5f5",
                        }}
                      >
                        <Image
                          src={detail.module.content.url}
                          alt={detail.module.title || "Materi gambar"}
                          fill
                          style={{ objectFit: "contain" }}
                          onLoad={() => {
                            // Auto-complete when image loaded
                            if (!autoCompletedRef.current) {
                              autoCompletedRef.current = true;
                              markCompleteAuto();
                            }
                          }}
                        />
                      </div>
                    </Card>
                  ) : detail.module.kind === "blockly" ? (
                    <Card withBorder p="md">
                      <Group gap="xs" mb="sm">
                        <IconPuzzle size={18} />
                        <Text fw={600}>Proyek Blockly</Text>
                      </Group>
                      <Text size="sm" c="dimmed" mb="md">
                        {detail.module.description ||
                          "Selesaikan proyek visual programming menggunakan Blockly (drag-and-drop)."}
                      </Text>
                      <Button
                        className="btn-primary"
                        leftSection={<IconPuzzle size={16} />}
                        onClick={() => {
                          // Navigate to blockly project editor (placeholder for now)
                          router.push(`/user/projects/${detail.module.id}`);
                        }}
                      >
                        Buka Editor Blockly
                      </Button>
                    </Card>
                  ) : (
                    <Card withBorder p="md">
                      <Text size="sm">Konten tidak tersedia.</Text>
                    </Card>
                  )}

                  {/* Manual complete: only for materi text/link not yet completed; exclude quiz, assignment, file/pdf/video, already completed */}
                  {detail.module.kind === "materi" &&
                    !(detail.module.assignment || detail.module.quiz) &&
                    (detail.module.content?.type === "text" ||
                      detail.module.content?.type === "link" ||
                      detail.module.content?.text) &&
                    !/\.pdf($|\?)/i.test(detail.module.content?.url || "") &&
                    !["file", "video"].includes(
                      String(detail.module.content?.type || "")
                    ) &&
                    !modules.find((m) => m.id === currentId)?.isCompleted && (
                      <Group justify="flex-end" mt="lg">
                        <Button
                          onClick={markComplete}
                          loading={posting}
                          color="green"
                          variant="filled"
                        >
                          Tandai Selesai
                        </Button>
                      </Group>
                    )}

                  {/* Success Alert */}
                  {completionSuccess && (
                    <Alert
                      color="green"
                      mt="md"
                      variant="light"
                      radius="md"
                      withCloseButton
                      onClose={() => setCompletionSuccess(false)}
                    >
                      Modul berhasil ditandai selesai!
                    </Alert>
                  )}

                  {/* Certificate Download Section */}
                  {modules.length > 0 &&
                    modules.filter((m) => m.isCompleted).length ===
                      modules.length && (
                      <Alert
                        color="blue"
                        mt="md"
                        variant="light"
                        radius="md"
                        title="🎓 Kursus Selesai!"
                      >
                        <Stack gap="sm">
                          <Text size="sm">
                            Selamat! Anda telah menyelesaikan seluruh kursus.
                            Sertifikat digital sudah tersedia untuk diunduh.
                          </Text>
                          {/* Rating gating: show prompt if no userRating yet */}
                          <RatingPrompt />
                          <Group>
                            <Button
                              onClick={() => {
                                if (!userRating) {
                                  notifications.show({
                                    title: "Rating Diperlukan",
                                    message:
                                      "Silakan berikan rating kursus sebelum mengunduh sertifikat.",
                                    color: "yellow",
                                  });
                                  return;
                                }
                                downloadCertificate();
                              }}
                              loading={downloadingCertificate}
                              variant={userRating ? "gradient" : "light"}
                              gradient={{ from: "blue", to: "indigo", deg: 45 }}
                              leftSection={<IconFileText size={16} />}
                              size="sm"
                              disabled={!userRating}
                              title={
                                userRating
                                  ? undefined
                                  : "Beri rating terlebih dahulu"
                              }
                            >
                              {userRating
                                ? certificateUrl
                                  ? "Unduh Sertifikat"
                                  : "Buat & Unduh Sertifikat"
                                : "Beri Rating Untuk Membuka"}
                            </Button>
                            {/* Tombol Generate Ulang hanya muncul jika sertifikat sudah pernah dibuat */}
                            {certificateUrl && userRating && (
                              <Button
                                onClick={regenerateCertificate}
                                loading={downloadingCertificate}
                                variant="outline"
                                color="orange"
                                leftSection={<IconRefresh size={16} />}
                                size="sm"
                              >
                                Generate Ulang
                              </Button>
                            )}
                            {certificateUrl && (
                              <Button
                                component="a"
                                href={certificateUrl}
                                target="_blank"
                                variant="outline"
                                color="blue"
                                size="sm"
                              >
                                Lihat Sertifikat
                              </Button>
                            )}
                          </Group>
                        </Stack>
                      </Alert>
                    )}
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Quiz Review Modal */}
      <Modal
        opened={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={<Text fw={600}>Pembahasan Kuis</Text>}
        size="lg"
        centered
        scrollAreaComponent={Modal.Body}
      >
        <Stack gap="md">
          {detail?.attemptAnswers?.map((answer, index) => (
            <Card key={answer.questionId} withBorder p="md" radius="md">
              <Group align="flex-start" gap="sm" mb="sm">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: answer.isCorrect ? "#16a34a" : "#dc2626",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={600} mb="xs" style={{ lineHeight: 1.4 }}>
                    {answer.question}
                  </Text>

                  <Text
                    size="sm"
                    c={answer.isCorrect ? "green" : "red"}
                    fw={600}
                    mb={answer.isCorrect ? "xs" : 4}
                  >
                    Jawaban Anda: {answer.userAnswer}
                  </Text>

                  {!answer.isCorrect && (
                    <Text size="sm" c="dimmed" mb="xs">
                      Jawaban benar: {answer.correctAnswer}
                    </Text>
                  )}

                  {answer.explanation && (
                    <Alert color="blue" variant="light" radius="md" mt="sm">
                      <Text
                        size="sm"
                        style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}
                      >
                        <strong>Penjelasan:</strong>
                        <br />
                        {answer.explanation}
                      </Text>
                    </Alert>
                  )}
                </div>
              </Group>
            </Card>
          ))}

          {(!detail?.attemptAnswers || detail.attemptAnswers.length === 0) && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Tidak ada data jawaban yang tersedia.
            </Text>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}

// --- Live Session Panel Component ---
function LiveSessionPanel({
  live,
  userName,
}: {
  live: NonNullable<ModuleDetailType["module"]["liveSession"]>;
  userName: string;
}) {
  const [copied, setCopied] = useState(false);
  // Prefer explicit new fields if present
  const rawStart = live.start_at || live.startTime;
  const start = rawStart ? new Date(rawStart) : null;
  let end: Date | null = null;
  if (live.endTime) {
    end = new Date(live.endTime);
  } else if (start && (live.duration_min || 0) > 0) {
    end = new Date(start.getTime() + (live.duration_min || 0) * 60000);
  }
  const now = useMemo(() => new Date(), []);
  const status: "upcoming" | "live" | "ended" = (() => {
    if (!start) return "upcoming";
    if (end && now > end) return "ended";
    if (now >= start && (!end || now <= end)) return "live";
    return "upcoming";
  })();

  const diffMs = start ? start.getTime() - now.getTime() : 0;
  const diffParts =
    diffMs > 0
      ? {
          d: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
          h: Math.floor((diffMs / (1000 * 60 * 60)) % 24),
          m: Math.floor((diffMs / (1000 * 60)) % 60),
        }
      : { d: 0, h: 0, m: 0 };

  const joinBase =
    (live.join_url || live.meetUrl) &&
    (live.join_url || live.meetUrl)!.startsWith("http")
      ? (live.join_url || live.meetUrl)!
      : live.joinCode
      ? `https://meet.jit.si/${encodeURIComponent(live.joinCode)}`
      : undefined;

  const icsContent = () => {
    if (!start) return "";
    const endCalc =
      end || new Date(start.getTime() + (live.duration_min || 60) * 60000);
    const dtStart = toICSDate(start);
    const dtEnd = toICSDate(endCalc);
    const uid = `${live.id || dtStart}@afterschola`;
    const url = joinBase || "https://meet.jit.si";
    const summary = escapeICS(live.title || "Live Session");
    const description = escapeICS(
      (live.agenda || "Live learning session") +
        (joinBase ? `\nJoin: ${joinBase}` : "")
    );
    return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AfterSchola//Live Session//ID\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtStart}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${summary}\nDESCRIPTION:${description}\nURL:${url}\nEND:VEVENT\nEND:VCALENDAR`;
  };

  const downloadICS = () => {
    const blob = new Blob([icsContent()], {
      type: "text/calendar;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `live-session-${live.id}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };

  return (
    <Card
      withBorder
      p="md"
      mb="md"
      radius="md"
      style={{ background: "linear-gradient(145deg,#f0f4ff,#ffffff)" }}
    >
      <Group justify="space-between" align="flex-start" mb={8}>
        <div>
          <Text fw={600} size="sm" c="black" style={{ letterSpacing: 0.2 }}>
            Live Session
          </Text>
          <Text size="sm" c="dimmed" mt={2}>
            {live.title || "Sesi Langsung"}
          </Text>
        </div>
        <StatusBadge status={status} />
      </Group>
      {live.agenda && (
        <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap" }} mb={8}>
          {live.agenda}
        </Text>
      )}
      <Stack gap={6}>
        {start && (
          <Text size="xs" c="dimmed">
            Mulai: {start.toLocaleString("id-ID")}
          </Text>
        )}
        {end && (
          <Text size="xs" c="dimmed">
            Selesai: {end.toLocaleString("id-ID")}
          </Text>
        )}
        {status === "upcoming" && start && (
          <Text size="xs" fw={600}>
            Mulai dalam: {diffParts.d > 0 && `${diffParts.d}h `}
            {diffParts.h}j {diffParts.m}m
          </Text>
        )}
        {joinBase && status === "live" && (
          <Button
            component="a"
            href={
              joinBase +
              `#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(
                userName
              )}`
            }
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            className="btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            Masuk Ruang
          </Button>
        )}
        {status === "upcoming" && (
          <Group gap={6}>
            {joinBase && (
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  navigator.clipboard.writeText(joinBase || "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Link Disalin" : "Salin Link"}
              </Button>
            )}
            {start && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    size="xs"
                    variant="gradient"
                    gradient={{ from: "indigo", to: "blue", deg: 45 }}
                    leftSection={<IconCalendarPlus size={14} />}
                  >
                    Tambah ke Kalender
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Pilih Kalender</Menu.Label>
                  <Menu.Item
                    leftSection={<IconCalendarPlus size={14} />}
                    onClick={downloadICS}
                  >
                    Unduh .ics
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconCalendarPlus size={14} />}
                    component="a"
                    href={(() => {
                      const endDate =
                        end || new Date(start.getTime() + 60 * 60000);
                      const fmt = (d: Date) =>
                        d
                          .toISOString()
                          .replace(/[-:]/g, "")
                          .replace(/\.\d{3}Z$/, "Z");
                      const text = encodeURIComponent(
                        live.title || "Live Session"
                      );
                      const details = encodeURIComponent(
                        (live.agenda || "") +
                          (joinBase ? `\nJoin: ${joinBase}` : "")
                      );
                      const location = encodeURIComponent(joinBase || "Online");
                      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(
                        start
                      )}/${fmt(
                        endDate
                      )}&details=${details}&location=${location}&ctz=${encodeURIComponent(
                        live.time_zone || "Asia/Jakarta"
                      )}`;
                    })()}
                    target="_blank"
                  >
                    Google Calendar
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        )}
        {status === "ended" && (
          <Text size="xs" c="dimmed" fw={500}>
            Sesi telah berakhir.
          </Text>
        )}
      </Stack>

      {/* Passcode */}
      {live.passcode && (
        <Text size="xs" c="dimmed">
          Passcode: <strong>{live.passcode}</strong>
        </Text>
      )}
      {/* Recording link when ended */}
      {status === "ended" && live.recording_url && (
        <Button
          component="a"
          href={live.recording_url}
          target="_blank"
          variant="light"
          size="xs"
          mt={6}
        >
          Lihat Rekaman
        </Button>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: "upcoming" | "live" | "ended" }) {
  const color =
    status === "live" ? "green" : status === "upcoming" ? "orange" : "gray";
  const label =
    status === "live"
      ? "Sedang Berlangsung"
      : status === "upcoming"
      ? "Segera"
      : "Selesai";
  return (
    <div
      style={{
        background: `var(--${
          color === "green"
            ? "success-color"
            : color === "orange"
            ? "secondary-color"
            : "hover-bg"
        })`,
        color:
          color === "gray" ? "#444" : color === "orange" ? "#1e3769" : "#fff",
        fontSize: 11,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 20,
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

function toICSDate(d: Date) {
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    d.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

function escapeICS(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
