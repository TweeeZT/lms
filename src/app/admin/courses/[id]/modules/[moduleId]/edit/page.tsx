/* eslint-disable react-hooks/rules-of-hooks */
"use client";
import React, {
  useEffect,
  useState,
  useCallback,
  use as usePromise,
} from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Radio,
  Stack,
  Textarea,
  TextInput,
  Title,
  Select,
  Divider,
  SimpleGrid,
  Text,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import RichTextEditor from "@/components/RichTextEditor";

type QuizQuestion = {
  question: string;
  q_type: "multiple-choice" | "true-false" | "short-answer";
  options?: string[];
  correct: string;
  explanation?: string;
};

type ContentType = "link" | "file" | "text";

interface ModuleFull {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  module_kind: "materi" | "quiz" | "tugas" | "live";
  is_published: boolean | null;
  content?: string | null;
  quiz_questions?: QuizQuestion[] | null;
  assignment?: { description?: string } | null;
  live_session_link?: string | null;
}

interface LiveSessionDetail {
  id: string;
  agenda: string | null;
  start_at: string | null;
  duration_min: number | null;
  join_url: string | null;
  status: string | null;
  created_by?: string | null;
  passcode?: string | null;
  time_zone?: string | null;
}

export default function AdminEditModulePage({
  params,
}: {
  params:
    | Promise<{ id: string; moduleId: string }>
    | { id: string; moduleId: string };
}) {
  const resolvedParams = (params as any)?.then
    ? usePromise(params as Promise<{ id: string; moduleId: string }>)
    : (params as { id: string; moduleId: string });
  const { id: courseId, moduleId } = resolvedParams;
  const router = useRouter();
  const { user } = useAuth();
  const adminId = user?.id || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<ModuleFull | null>(null);

  // Common fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState<number | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(true);

  // Materi content fields
  const [contentType, setContentType] = useState<ContentType>("text");
  const [contentUrl, setContentUrl] = useState("");
  const [contentText, setContentText] = useState("");

  // Quiz fields
  const [quizTitle, setQuizTitle] = useState("");
  const [passingScore, setPassingScore] = useState<number | "">(70);
  const [timeLimit, setTimeLimit] = useState<number | "">(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Tugas fields
  const [tugasInstructions, setTugasInstructions] = useState("");

  // Live session fields
  const [liveAgenda, setLiveAgenda] = useState("");
  const [liveStartAt, setLiveStartAt] = useState<Date | null>(null);
  const [liveDuration, setLiveDuration] = useState<number>(60);
  const [liveJoinUrl, setLiveJoinUrl] = useState("");
  const [livePasscode, setLivePasscode] = useState("");

  // Quiz helpers
  const addQuestion = () => {
    setQuestions((q) => [
      ...q,
      {
        question: "",
        q_type: "multiple-choice",
        options: ["", "", "", ""],
        correct: "0",
      },
    ]);
  };

  const removeQuestion = (i: number) => {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  };

  const updateQuestion = (i: number, patch: Partial<QuizQuestion>) => {
    setQuestions((q) =>
      q.map((qq, idx) => (idx === i ? { ...qq, ...patch } : qq))
    );
  };

  const updateOption = (qi: number, oi: number, val: string) => {
    setQuestions((q) =>
      q.map((qq, idx) =>
        idx === qi
          ? { ...qq, options: qq.options?.map((o, j) => (j === oi ? val : o)) }
          : qq
      )
    );
  };

  const fetchModule = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    setError(null);
    try {
      console.log("🔍 Fetching module:", moduleId, "with adminId:", adminId);
      const res = await fetch(
        `/api/admin/modules/${moduleId}?userId=${adminId}`
      );
      console.log("📡 Response status:", res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error:", errorText);
        throw new Error("Gagal memuat modul: " + errorText);
      }

      const json = await res.json();
      console.log("✅ API Response:", json);
      const m: ModuleFull = json.item;
      console.log("📦 Module data:", m);
      setModuleData(m);
      setTitle(m.title);
      setDescription(m.description || "");
      setIsPublished(m.is_published !== false);

      // Parse based on module kind
      if (m.module_kind === "materi") {
        // Check if content is object from API response
        const contentData = (m as any).content;
        if (contentData && typeof contentData === "object") {
          setContentType((contentData.content_type as ContentType) || "text");
          setContentUrl(contentData.url || "");
          setContentText(contentData.text_content || "");
        } else {
          // Fallback: try to parse as JSON string
          try {
            const parsed = JSON.parse(m.content || "{}");
            setContentType((parsed.type as ContentType) || "text");
            setContentUrl(parsed.url || "");
            setContentText(parsed.text || "");
          } catch {
            // Old format: plain text
            setContentType("text");
            setContentText(m.content || "");
          }
        }
      } else if (m.module_kind === "quiz") {
        // Check if quiz data is from API response
        const quizApiData = (m as any).quiz;
        console.log("[Edit Quiz Debug] quizApiData:", quizApiData);
        if (quizApiData && typeof quizApiData === "object") {
          setQuizTitle(quizApiData.title || "");
          setPassingScore(quizApiData.passing_score ?? 70);
          setTimeLimit(quizApiData.time_limit ?? 10);
          const qs = Array.isArray(quizApiData.questions)
            ? quizApiData.questions
            : [];
          console.log("[Edit Quiz Debug] questions array:", qs);
          const mappedQuestions = qs.map((q: any) => ({
            question: q.question || "",
            q_type: q.q_type || "multiple-choice",
            options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
            correct: String(q.correct || "1"),
            explanation: q.explanation || "",
          }));
          console.log("[Edit Quiz Debug] mapped questions:", mappedQuestions);
          setQuestions(mappedQuestions);
        }
      } else if (m.module_kind === "tugas") {
        // Check if assignment data is from API response
        const assignApiData = (m as any).assignment;
        if (assignApiData && typeof assignApiData === "object") {
          setTugasInstructions(assignApiData.instructions || "");
        } else {
          // Fallback
          const assignmentData = m.assignment || {};
          setTugasInstructions(
            assignmentData.description || m.description || ""
          );
        }
      } else if (m.module_kind === "live") {
        if ((m as any).live) {
          const lv = (m as any).live as LiveSessionDetail;
          setLiveAgenda(lv.agenda || "");
          setLiveDuration(lv.duration_min ?? 60);
          setLiveJoinUrl(lv.join_url || "");
          setLivePasscode(lv.passcode || "");
          setLiveStartAt(lv.start_at ? new Date(lv.start_at) : null);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat modul";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [adminId, moduleId]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  const handleSave = async () => {
    if (!adminId || !moduleData) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title,
        description: description || null,
        is_published: isPublished,
      };

      if (moduleData.module_kind === "materi") {
        // Build content JSON
        const contentData: any = { type: contentType };
        if (contentType === "text") {
          contentData.text = contentText;
        } else if (contentType === "link") {
          contentData.url = contentUrl;
        }
        body.content = JSON.stringify(contentData);
      } else if (moduleData.module_kind === "quiz") {
        body.quiz_questions = questions;
        body.quiz_title = quizTitle;
        body.passing_score = passingScore;
        body.time_limit = timeLimit;
      } else if (moduleData.module_kind === "tugas") {
        body.assignment = { description: tugasInstructions };
      } else if (moduleData.module_kind === "live") {
        if (!liveAgenda.trim() || !liveStartAt || !liveJoinUrl.trim()) {
          throw new Error("Field wajib live: agenda, waktu mulai, link live");
        }
        body.live_agenda = liveAgenda.trim();
        body.live_start_at = liveStartAt.toISOString();
        body.live_join_url = liveJoinUrl.trim();
        body.live_duration_min = liveDuration;
        if (livePasscode.trim()) body.live_passcode = livePasscode.trim();
      }

      const res = await fetch(
        `/api/admin/modules/${moduleData.id}?userId=${adminId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal menyimpan");
      }

      notifications.show({
        color: "green",
        title: "Berhasil!",
        message: "Modul berhasil diupdate",
      });

      router.push(`/admin/courses/${courseId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      setError(msg);
      notifications.show({
        color: "red",
        title: "Gagal!",
        message: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderModuleSpecificFields = () => {
    if (!moduleData) return null;

    switch (moduleData.module_kind) {
      case "materi":
        return (
          <Card withBorder p="md" mt="md">
            <Title order={5}>Konten Materi</Title>
            <Stack gap="sm" mt="xs">
              <Select
                label="Tipe Konten"
                data={[
                  { value: "link", label: "Link" },
                  { value: "text", label: "Teks" },
                  { value: "file", label: "File" },
                ]}
                value={contentType}
                onChange={(v) => setContentType((v as ContentType) || "text")}
              />
              {contentType === "link" && (
                <TextInput
                  label="URL"
                  placeholder="https://..."
                  value={contentUrl}
                  onChange={(e) => setContentUrl(e.currentTarget.value)}
                  required
                />
              )}
              {contentType === "text" && (
                <div>
                  <Text size="sm" fw={500} mb={8}>
                    Konten Teks <span style={{ color: "red" }}>*</span>
                  </Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    {contentText.replace(/<[^>]*>/g, "").length}/65535 karakter
                  </Text>
                  <RichTextEditor
                    value={contentText}
                    onChange={(val) => {
                      // Strip HTML to count actual text length
                      const plainText = val.replace(/<[^>]*>/g, "");
                      if (plainText.length <= 65535) {
                        setContentText(val);
                      }
                    }}
                    placeholder="Tulis materi pembelajaran..."
                    minHeight="400px"
                  />
                </div>
              )}
              {contentType === "file" && (
                <Alert color="yellow" title="Catatan">
                  Untuk mengganti file, silakan buat modul baru. Edit tidak
                  mendukung upload file.
                </Alert>
              )}
            </Stack>
          </Card>
        );

      case "quiz":
        return (
          <Stack>
            <TextInput
              label="Judul Kuis"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.currentTarget.value)}
            />
            <Group grow>
              <NumberInput
                label="Passing Score (%)"
                value={passingScore}
                onChange={(v) =>
                  setPassingScore(typeof v === "number" ? v : "")
                }
                min={0}
                max={100}
              />
              <NumberInput
                label="Waktu (menit)"
                value={timeLimit}
                onChange={(v) => setTimeLimit(typeof v === "number" ? v : "")}
                min={0}
                max={999}
              />
            </Group>
            <Divider label={`Pertanyaan (${questions.length})`} />
            <Stack>
              {questions.map((q, qi) => (
                <Card key={qi} withBorder padding="sm">
                  <Stack>
                    <Group justify="space-between" align="flex-start">
                      <TextInput
                        label={`Pertanyaan ${qi + 1}`}
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(qi, {
                            question: e.currentTarget.value,
                          })
                        }
                        required
                        style={{ flex: 1 }}
                      />
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => removeQuestion(qi)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                    <Select
                      label="Tipe"
                      data={[
                        { value: "multiple-choice", label: "Multiple Choice" },
                        { value: "true-false", label: "True / False" },
                        { value: "short-answer", label: "Jawaban Singkat" },
                      ]}
                      value={q.q_type}
                      onChange={(v) =>
                        updateQuestion(qi, {
                          q_type:
                            (v as QuizQuestion["q_type"]) || "multiple-choice",
                        })
                      }
                    />
                    {q.q_type === "multiple-choice" && (
                      <SimpleGrid cols={2} spacing="xs">
                        {q.options?.map((opt, oi) => (
                          <TextInput
                            key={oi}
                            label={`Opsi ${oi + 1}`}
                            value={opt}
                            onChange={(e) =>
                              updateOption(qi, oi, e.currentTarget.value)
                            }
                          />
                        ))}
                      </SimpleGrid>
                    )}
                    {q.q_type === "multiple-choice" ? (
                      <NumberInput
                        label="Jawaban Benar (Nomor Opsi)"
                        description="Masukkan nomor opsi yang benar (1-4)"
                        value={Number(q.correct) || 1}
                        onChange={(v) =>
                          updateQuestion(qi, { correct: String(v || 1) })
                        }
                        min={1}
                        max={4}
                        required
                      />
                    ) : q.q_type === "true-false" ? (
                      <Select
                        label="Jawaban Benar"
                        data={[
                          { value: "true", label: "True" },
                          { value: "false", label: "False" },
                        ]}
                        value={q.correct}
                        onChange={(v) =>
                          updateQuestion(qi, { correct: v || "true" })
                        }
                        required
                      />
                    ) : (
                      <TextInput
                        label="Jawaban Benar"
                        description="Masukkan teks jawaban yang benar"
                        value={q.correct}
                        onChange={(e) =>
                          updateQuestion(qi, { correct: e.currentTarget.value })
                        }
                        required
                      />
                    )}
                    <Textarea
                      label="Penjelasan (opsional)"
                      value={q.explanation || ""}
                      onChange={(e) =>
                        updateQuestion(qi, {
                          explanation: e.currentTarget.value,
                        })
                      }
                      minRows={2}
                    />
                  </Stack>
                </Card>
              ))}
              <Button
                leftSection={<IconPlus size={16} />}
                variant="light"
                onClick={addQuestion}
              >
                Tambah Pertanyaan
              </Button>
            </Stack>
          </Stack>
        );

      case "tugas":
        return (
          <Card withBorder p="md" mt="md">
            <Title order={5}>Tugas</Title>
            <Stack gap="sm" mt="xs">
              <Textarea
                label="Instruksi Tugas"
                description="Deskripsi lengkap tugas yang harus dikerjakan siswa"
                value={tugasInstructions}
                onChange={(e) => setTugasInstructions(e.currentTarget.value)}
                minRows={6}
                required
              />
            </Stack>
          </Card>
        );

      case "live":
        return (
          <Card withBorder p="md" mt="md">
            <Title order={5}>Live Session</Title>
            <Stack gap="sm" mt="xs">
              <Textarea
                label="Agenda"
                value={liveAgenda}
                onChange={(e) => setLiveAgenda(e.currentTarget.value)}
                minRows={3}
                required
              />
              <DateTimePicker
                required
                label="Waktu Mulai"
                value={liveStartAt}
                onChange={(val) => {
                  if (!val) {
                    setLiveStartAt(null);
                    return;
                  }
                  const isDate =
                    Object.prototype.toString.call(val) === "[object Date]";
                  if (isDate) {
                    const d = val as unknown as Date;
                    setLiveStartAt(isNaN(d.getTime()) ? null : d);
                  } else if (typeof val === "string") {
                    const d = new Date(val);
                    setLiveStartAt(isNaN(d.getTime()) ? null : d);
                  }
                }}
              />
              <NumberInput
                label="Durasi (menit)"
                value={liveDuration}
                onChange={(v) => setLiveDuration(Number(v || 60))}
                min={1}
              />
              <TextInput
                label="Link Live"
                placeholder="https://zoom.us/j/..."
                value={liveJoinUrl}
                onChange={(e) => setLiveJoinUrl(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Passcode (opsional)"
                value={livePasscode}
                onChange={(e) => setLivePasscode(e.currentTarget.value)}
              />
            </Stack>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Box p="lg">
      <Group mb="md">
        <ActionIcon variant="default" onClick={() => router.back()}>
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Title order={3}>Edit Modul</Title>
      </Group>

      {error && (
        <Alert color="red" mb="md" title="Error">
          {error}
        </Alert>
      )}

      {loading && (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      )}

      {!loading && moduleData && (
        <Card withBorder>
          <Stack>
            <Alert color="blue" title="Perhatian">
              Jenis modul ({moduleData.module_kind}) tidak dapat diubah saat
              edit. Jika perlu mengubah jenis modul, silakan buat modul baru.
            </Alert>

            <TextInput
              label="Judul"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
            />
            <Textarea
              label="Deskripsi"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              minRows={3}
            />
            <Radio.Group
              name="publish"
              label="Status"
              value={isPublished ? "published" : "draft"}
              onChange={(v) => setIsPublished(v === "published")}
            >
              <Group mt="xs">
                <Radio value="published" label="Published" />
                <Radio value="draft" label="Draft" />
              </Group>
            </Radio.Group>

            <Divider label="Detail Khusus" />
            {renderModuleSpecificFields()}

            <Group justify="flex-end" mt="md">
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saving}
                onClick={handleSave}
                disabled={
                  !title ||
                  (moduleData.module_kind === "materi" &&
                    contentType === "text" &&
                    !contentText.trim()) ||
                  (moduleData.module_kind === "live" &&
                    (!liveAgenda.trim() || !liveStartAt || !liveJoinUrl.trim()))
                }
              >
                Simpan Perubahan
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Box>
  );
}
