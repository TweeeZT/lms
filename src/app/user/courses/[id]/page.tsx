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
  Progress,
  Group,
  Badge,
  Button,
  SimpleGrid,
  Box,
  Paper,
  Divider,
  Avatar,
  Rating,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconFileText,
  IconListCheck,
  IconClipboard,
  IconVideo,
  IconCircleCheck,
  IconLock,
  IconClock,
  IconBook,
  IconTrophy,
  IconDownload,
  IconChevronRight,
  IconStar,
  IconCalendar,
  IconUser,
} from "@tabler/icons-react";
import { useAuth } from "../../../../hooks/useAuth";
import Image from "next/image";
import PrimeLoader from "../../../../components/PrimeLoader";

// Types
type ModuleListItem = {
  id: string;
  title: string;
  kind: string;
  order: number;
  isCompleted: boolean;
  description?: string | null;
};

type CourseData = {
  id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  instructorId: string;
  instructorName?: string;
  category: string;
  level: string;
  totalModules: number;
  enrolledCount: number;
  rating?: number;
};

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

export default function CourseOverviewPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);

  // Load course and modules
  useEffect(() => {
    if (!user || !courseId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load course info
        const courseRes = await fetch(
          `/api/user/courses/${courseId}?userId=${user.id}`
        );

        // Check if response is JSON
        const contentType = courseRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server error: Invalid response format");
        }

        const courseJson = await courseRes.json();
        if (!courseRes.ok || !courseJson.success) {
          throw new Error(courseJson.error || "Gagal memuat kursus");
        }
        setCourse(courseJson.course);

        // Load modules
        const modulesRes = await fetch(
          `/api/user/courses/${courseId}/modules?userId=${user.id}`
        );

        const modulesContentType = modulesRes.headers.get("content-type");
        if (
          !modulesContentType ||
          !modulesContentType.includes("application/json")
        ) {
          throw new Error("Server error: Invalid modules response format");
        }

        const modulesJson = await modulesRes.json();
        if (!modulesRes.ok || !modulesJson.success) {
          throw new Error(modulesJson.error || "Gagal memuat modul");
        }
        setModules(modulesJson.items || []);

        // Check certificate & rating
        const certRes = await fetch(
          `/api/user/certificates?userId=${user.id}&courseId=${courseId}`
        );

        if (certRes.headers.get("content-type")?.includes("application/json")) {
          const certJson = await certRes.json();
          if (certRes.ok && certJson.success) {
            setUserRating(certJson.rating || null);
            setCertificateUrl(certJson.certificateUrl || null);
          }
        }
      } catch (e) {
        console.error("Error loading course data:", e);
        const errorMsg = e instanceof Error ? e.message : "Gagal memuat data";
        setError(errorMsg);
        notifications.show({
          title: "Error",
          message: errorMsg,
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, courseId]);

  // Calculate progress
  const completedCount = modules.filter((m) => m.isCompleted).length;
  const totalCount = modules.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const courseCompleted = totalCount > 0 && completedCount === totalCount;

  // Group modules by type
  const materiModules = modules.filter((m) => m.kind === "materi");
  const quizModules = modules.filter((m) => m.kind === "quiz");
  const tugasModules = modules.filter((m) => m.kind === "tugas");
  const liveModules = modules.filter((m) => m.kind === "live");

  // Handle module click
  const handleModuleClick = (moduleId: string) => {
    router.push(`/user/courses/${courseId}/modules/${moduleId}`);
  };

  // Handle rating submit
  const handleRatingSubmit = async (rating: number) => {
    if (!user || !courseId) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/user/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, courseId, rating }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUserRating(rating);
        notifications.show({
          title: "Rating Berhasil",
          message: "Terima kasih atas rating Anda!",
          color: "green",
        });
      } else {
        throw new Error(json.error || "Gagal menyimpan rating");
      }
    } catch (err) {
      notifications.show({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal menyimpan rating",
        color: "red",
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  // Handle certificate download
  const handleDownloadCertificate = async () => {
    if (!user || !courseId) return;
    setDownloadingCert(true);
    try {
      const res = await fetch(`/api/user/certificates/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, courseId }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.certificateUrl) {
        setCertificateUrl(json.certificateUrl);
        window.open(json.certificateUrl, "_blank");
        notifications.show({
          title: "Berhasil",
          message: "Sertifikat berhasil di-generate!",
          color: "green",
        });
      } else {
        throw new Error(json.error || "Gagal generate sertifikat");
      }
    } catch (err) {
      notifications.show({
        title: "Gagal",
        message:
          err instanceof Error ? err.message : "Gagal generate sertifikat",
        color: "red",
      });
    } finally {
      setDownloadingCert(false);
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

  if (!user) {
    return null;
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

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Back Button */}
        <Button
          variant="subtle"
          size="md"
          onClick={() => router.push("/user/courses")}
          leftSection={
            <IconChevronRight
              size={20}
              style={{ transform: "rotate(180deg)" }}
            />
          }
        >
          Kembali ke Kursus Saya
        </Button>

        {/* Course Header */}
        <Paper
          withBorder
          p="xl"
          radius="lg"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Group align="flex-start" gap="xl">
            {course?.thumbnail && (
              <Box
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "3px solid rgba(255,255,255,0.2)",
                  position: "relative",
                }}
              >
                <Image
                  src={course.thumbnail}
                  alt={course.title}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </Box>
            )}
            <Stack gap="md" style={{ flex: 1 }}>
              <Title order={1} c="white">
                {course?.title || "Untitled Course"}
              </Title>
              <Text c="white" opacity={0.9} size="sm">
                {course?.description || "No description"}
              </Text>
              <Group gap="md">
                <Badge size="lg" color="yellow" variant="filled">
                  {MODULE_LABELS[
                    course?.category as keyof typeof MODULE_LABELS
                  ] || course?.category}
                </Badge>
                <Badge size="lg" color="white" variant="outline">
                  {course?.level}
                </Badge>
                <Group gap={4}>
                  <IconStar size={16} color="gold" fill="gold" />
                  <Text c="white" size="sm" fw={600}>
                    {course?.rating?.toFixed(1) || "N/A"}
                  </Text>
                </Group>
                <Group gap={4}>
                  <IconUser size={16} color="white" />
                  <Text c="white" size="sm">
                    {course?.enrolledCount || 0} siswa
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Group>

          {/* Progress Bar */}
          <Box mt="xl">
            <Group justify="space-between" mb="xs">
              <Text c="white" fw={600}>
                Progres Kursus
              </Text>
              <Text c="white" fw={700}>
                {progressPercent}%
              </Text>
            </Group>
            <Progress
              value={progressPercent}
              size="xl"
              radius="xl"
              color="yellow"
            />
            <Group justify="space-between" mt="xs">
              <Text c="white" size="sm" opacity={0.8}>
                {completedCount} dari {totalCount} modul selesai
              </Text>
              {courseCompleted && (
                <Badge
                  size="lg"
                  color="green"
                  variant="filled"
                  leftSection={<IconTrophy size={16} />}
                >
                  Selesai!
                </Badge>
              )}
            </Group>
          </Box>
        </Paper>

        {/* Certificate & Rating Section */}
        {courseCompleted && (
          <Paper withBorder p="xl" radius="lg">
            <Stack gap="lg">
              <Group justify="space-between" align="center">
                <div>
                  <Title order={3}>🎉 Selamat! Kursus Selesai</Title>
                  <Text c="dimmed" size="sm">
                    Berikan rating dan unduh sertifikat Anda
                  </Text>
                </div>
                <Button
                  size="lg"
                  leftSection={<IconDownload size={20} />}
                  onClick={handleDownloadCertificate}
                  loading={downloadingCert}
                  disabled={!courseCompleted}
                  color="blue"
                >
                  {certificateUrl
                    ? "Unduh Ulang Sertifikat"
                    : "Unduh Sertifikat"}
                </Button>
              </Group>

              <Divider />

              <div>
                <Text fw={600} mb="sm">
                  Berikan Rating Kursus
                </Text>
                <Group gap="xs">
                  <Rating
                    value={userRating || 0}
                    onChange={handleRatingSubmit}
                    size="xl"
                    color="yellow"
                  />
                  {userRating && (
                    <Text size="sm" c="dimmed">
                      ({userRating}/5)
                    </Text>
                  )}
                </Group>
              </div>
            </Stack>
          </Paper>
        )}

        {/* Modules Section */}
        <Stack gap="xl">
          {/* Materi Modules */}
          {materiModules.length > 0 && (
            <div>
              <Group mb="md">
                <IconFileText size={24} color="var(--primary-color)" />
                <Title order={3}>Materi Pembelajaran</Title>
                <Badge color="blue" variant="light">
                  {materiModules.filter((m) => m.isCompleted).length}/
                  {materiModules.length}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {materiModules.map((module) => {
                  const Icon = MODULE_ICONS.materi;
                  return (
                    <Card
                      key={module.id}
                      withBorder
                      p="lg"
                      radius="md"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.2s",
                        backgroundColor: module.isCompleted
                          ? "var(--mantine-color-green-0)"
                          : undefined,
                        borderColor: module.isCompleted
                          ? "var(--mantine-color-green-5)"
                          : undefined,
                        borderWidth: module.isCompleted ? 2 : 1,
                      }}
                      onClick={() => handleModuleClick(module.id)}
                      className="card-hover"
                    >
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Badge
                            color={
                              module.isCompleted
                                ? "green"
                                : MODULE_COLORS.materi
                            }
                            variant={module.isCompleted ? "filled" : "light"}
                          >
                            Modul {module.order}
                          </Badge>
                          {module.isCompleted && (
                            <IconCircleCheck
                              size={24}
                              color="var(--mantine-color-green-7)"
                            />
                          )}
                        </Group>
                        <Group gap="sm" align="flex-start">
                          <Icon
                            size={20}
                            color={
                              module.isCompleted
                                ? "var(--mantine-color-green-7)"
                                : MODULE_COLORS.materi
                            }
                          />
                          <Text fw={600} size="sm" style={{ flex: 1 }}>
                            {module.title}
                          </Text>
                        </Group>
                        {module.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {module.description}
                          </Text>
                        )}
                        <Button
                          size="xs"
                          variant="light"
                          color={module.isCompleted ? "green" : "blue"}
                          fullWidth
                          rightSection={<IconChevronRight size={16} />}
                        >
                          {module.isCompleted ? "Buka Lagi" : "Mulai Belajar"}
                        </Button>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </div>
          )}

          {/* Quiz Modules */}
          {quizModules.length > 0 && (
            <div>
              <Group mb="md">
                <IconListCheck size={24} color="var(--mantine-color-grape-6)" />
                <Title order={3}>Quiz</Title>
                <Badge color="grape" variant="light">
                  {quizModules.filter((m) => m.isCompleted).length}/
                  {quizModules.length}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {quizModules.map((module) => {
                  const Icon = MODULE_ICONS.quiz;
                  return (
                    <Card
                      key={module.id}
                      withBorder
                      p="lg"
                      radius="md"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.2s",
                        backgroundColor: module.isCompleted
                          ? "var(--mantine-color-green-0)"
                          : undefined,
                        borderColor: module.isCompleted
                          ? "var(--mantine-color-green-5)"
                          : undefined,
                        borderWidth: module.isCompleted ? 2 : 1,
                      }}
                      onClick={() => handleModuleClick(module.id)}
                      className="card-hover"
                    >
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Badge
                            color={
                              module.isCompleted ? "green" : MODULE_COLORS.quiz
                            }
                            variant={module.isCompleted ? "filled" : "light"}
                          >
                            Quiz {module.order}
                          </Badge>
                          {module.isCompleted && (
                            <IconCircleCheck
                              size={24}
                              color="var(--mantine-color-green-7)"
                            />
                          )}
                        </Group>
                        <Group gap="sm" align="flex-start">
                          <Icon
                            size={20}
                            color={
                              module.isCompleted
                                ? "var(--mantine-color-green-7)"
                                : MODULE_COLORS.quiz
                            }
                          />
                          <Text fw={600} size="sm" style={{ flex: 1 }}>
                            {module.title}
                          </Text>
                        </Group>
                        {module.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {module.description}
                          </Text>
                        )}
                        <Button
                          size="xs"
                          variant="light"
                          color={module.isCompleted ? "green" : "grape"}
                          fullWidth
                          rightSection={<IconChevronRight size={16} />}
                        >
                          {module.isCompleted ? "Lihat Hasil" : "Mulai Quiz"}
                        </Button>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </div>
          )}

          {/* Tugas Modules */}
          {tugasModules.length > 0 && (
            <div>
              <Group mb="md">
                <IconClipboard
                  size={24}
                  color="var(--mantine-color-orange-6)"
                />
                <Title order={3}>Tugas</Title>
                <Badge color="orange" variant="light">
                  {tugasModules.filter((m) => m.isCompleted).length}/
                  {tugasModules.length}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {tugasModules.map((module) => {
                  const Icon = MODULE_ICONS.tugas;
                  return (
                    <Card
                      key={module.id}
                      withBorder
                      p="lg"
                      radius="md"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.2s",
                        backgroundColor: module.isCompleted
                          ? "var(--mantine-color-green-0)"
                          : undefined,
                        borderColor: module.isCompleted
                          ? "var(--mantine-color-green-5)"
                          : undefined,
                        borderWidth: module.isCompleted ? 2 : 1,
                      }}
                      onClick={() => handleModuleClick(module.id)}
                      className="card-hover"
                    >
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Badge
                            color={
                              module.isCompleted ? "green" : MODULE_COLORS.tugas
                            }
                            variant={module.isCompleted ? "filled" : "light"}
                          >
                            Tugas {module.order}
                          </Badge>
                          {module.isCompleted && (
                            <IconCircleCheck
                              size={24}
                              color="var(--mantine-color-green-7)"
                            />
                          )}
                        </Group>
                        <Group gap="sm" align="flex-start">
                          <Icon
                            size={20}
                            color={
                              module.isCompleted
                                ? "var(--mantine-color-green-7)"
                                : MODULE_COLORS.tugas
                            }
                          />
                          <Text fw={600} size="sm" style={{ flex: 1 }}>
                            {module.title}
                          </Text>
                        </Group>
                        {module.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {module.description}
                          </Text>
                        )}
                        <Button
                          size="xs"
                          variant="light"
                          color={module.isCompleted ? "green" : "orange"}
                          fullWidth
                          rightSection={<IconChevronRight size={16} />}
                        >
                          {module.isCompleted
                            ? "Lihat Tugas"
                            : "Kerjakan Tugas"}
                        </Button>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </div>
          )}

          {/* Live Session Modules */}
          {liveModules.length > 0 && (
            <div>
              <Group mb="md">
                <IconVideo size={24} color="var(--mantine-color-red-6)" />
                <Title order={3}>Live Session</Title>
                <Badge color="red" variant="light">
                  {liveModules.filter((m) => m.isCompleted).length}/
                  {liveModules.length}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {liveModules.map((module) => {
                  const Icon = MODULE_ICONS.live;
                  return (
                    <Card
                      key={module.id}
                      withBorder
                      p="lg"
                      radius="md"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.2s",
                        backgroundColor: module.isCompleted
                          ? "var(--mantine-color-green-0)"
                          : undefined,
                        borderColor: module.isCompleted
                          ? "var(--mantine-color-green-5)"
                          : undefined,
                        borderWidth: module.isCompleted ? 2 : 1,
                      }}
                      onClick={() => handleModuleClick(module.id)}
                      className="card-hover"
                    >
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Badge
                            color={
                              module.isCompleted ? "green" : MODULE_COLORS.live
                            }
                            variant={module.isCompleted ? "filled" : "light"}
                          >
                            Live {module.order}
                          </Badge>
                          {module.isCompleted && (
                            <IconCircleCheck
                              size={24}
                              color="var(--mantine-color-green-7)"
                            />
                          )}
                        </Group>
                        <Group gap="sm" align="flex-start">
                          <Icon
                            size={20}
                            color={
                              module.isCompleted
                                ? "var(--mantine-color-green-7)"
                                : MODULE_COLORS.live
                            }
                          />
                          <Text fw={600} size="sm" style={{ flex: 1 }}>
                            {module.title}
                          </Text>
                        </Group>
                        {module.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {module.description}
                          </Text>
                        )}
                        <Button
                          size="xs"
                          variant="light"
                          color={module.isCompleted ? "green" : "red"}
                          fullWidth
                          rightSection={<IconChevronRight size={16} />}
                        >
                          {module.isCompleted
                            ? "Lihat Rekaman"
                            : "Lihat Detail"}
                        </Button>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </div>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
