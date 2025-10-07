"use client";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Radio,
  Stack,
  TextInput,
  Textarea,
  Title,
  FileInput,
  Select,
  Divider,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import RichTextEditor from "@/components/RichTextEditor";

const kinds = [
  { value: "materi", label: "Materi" },
  { value: "quiz", label: "Quiz" },
  { value: "tugas", label: "Tugas" },
  { value: "live", label: "Live" },
];

type QuizQuestion = {
  question: string;
  q_type: "multiple-choice" | "true-false" | "short-answer";
  options?: string[];
  correct: string; // index or answer text
  explanation?: string;
};

export default function AdminNewModulePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const adminId = user?.id || "";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleKind, setModuleKind] = useState<string>("materi");
  const [orderIndex, setOrderIndex] = useState<number | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Materi content
  type ContentType = "link" | "file" | "text";
  const [contentType, setContentType] = useState<ContentType>("link");
  const [contentUrl, setContentUrl] = useState("");
  const [contentText, setContentText] = useState("");
  const [contentFile, setContentFile] = useState<File | null>(null);

  // Quiz fields (simplified for admin placeholder; backend admin route currently ignores quiz details)
  const [quizTitle, setQuizTitle] = useState("");
  const [passingScore, setPassingScore] = useState<number | "">(70);
  const [timeLimit, setTimeLimit] = useState<number | "">(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Tugas fields
  const [tugasInstructions, setTugasInstructions] = useState("");

  // Live session (schema tanpa title; gunakan agenda, start_at, join_url, passcode)
  const [liveAgenda, setLiveAgenda] = useState("");
  const [liveStartAt, setLiveStartAt] = useState<Date | null>(null);
  const [liveJoinUrl, setLiveJoinUrl] = useState("");
  const [livePasscode, setLivePasscode] = useState("");

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

  const handleCreate = async () => {
    if (!adminId) return;
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      // Materi with file => multipart
      if (moduleKind === "materi" && contentFile) {
        const fd = new FormData();
        fd.set("title", title);
        fd.set("description", description);
        fd.set("module_kind", moduleKind);
        fd.set("order_index", String(orderIndex ?? 0));
        fd.set("is_published", String(isPublished));
        fd.set("content_type", contentType);
        if (contentUrl) fd.set("url", contentUrl);
        if (contentText) fd.set("text_content", contentText);
        fd.set("file", contentFile);
        fd.set("filename", contentFile.name);
        res = await fetch(
          `/api/admin/courses/${courseId}/modules?userId=${adminId}&debug=1`,
          { method: "POST", body: fd }
        );
      } else {
        const body: Record<string, unknown> = {
          title,
          description,
          module_kind: moduleKind,
          order_index: orderIndex ?? 0,
          is_published: isPublished,
        };

        if (moduleKind === "materi") {
          body.content = {
            content_type: contentType,
            url: contentUrl || undefined,
            text_content: contentText || undefined,
          };
        } else if (moduleKind === "quiz") {
          body.quiz = {
            title: quizTitle,
            passing_score: Number(passingScore || 70),
            time_limit: Number(timeLimit || 10),
            questions: questions,
          };
        } else if (moduleKind === "tugas") {
          body.assignment = {
            instructions: tugasInstructions,
            due_date: undefined,
            max_score: 100,
          };
        } else if (moduleKind === "live") {
          body.live = {
            agenda: liveAgenda.trim(),
            start_at: liveStartAt?.toISOString(),
            join_url: liveJoinUrl.trim(),
            duration_min: 60,
          };
          if (livePasscode.trim()) {
            (body.live as any).passcode = livePasscode.trim();
          }
        }

        res = await fetch(
          `/api/admin/courses/${courseId}/modules?userId=${adminId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        let msg = json.error || "Gagal membuat modul";
        if (json.debug) {
          console.warn("[AdminNewModule Debug]", json);
        }
        if (typeof msg === "string" && msg.includes("toISOString")) {
          msg =
            "Waktu mulai live tidak valid. Silakan pilih ulang tanggal & waktu.";
        }
        throw new Error(msg);
      }
      if (json.debug) {
        console.info("[AdminNewModule Debug Success]", json.debug);
      }

      notifications.show({
        color: "green",
        title: "Berhasil!",
        message: "Modul berhasil dibuat",
      });

      router.push(`/admin/courses/${courseId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat modul";
      setError(msg);
      notifications.show({
        color: "red",
        title: "Gagal!",
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderExtra = () => {
    switch (moduleKind) {
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
                onChange={(v) => setContentType((v as ContentType) || "link")}
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
                    {contentText.length}/65535 karakter
                  </Text>
                  <RichTextEditor
                    value={contentText}
                    onChange={(val) => {
                      if (val.length <= 65535) {
                        setContentText(val);
                      }
                    }}
                    placeholder="Tulis materi pembelajaran..."
                    minHeight="400px"
                  />
                </div>
              )}
              {contentType === "file" && (
                <FileInput
                  label="Upload File"
                  placeholder="Pilih file"
                  value={contentFile}
                  onChange={setContentFile}
                  required
                />
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
              required
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
              <TextInput
                label="Link Live"
                placeholder="https://..."
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
      case "tugas":
        return (
          <Card withBorder p="md" mt="md">
            <Title order={5}>Tugas</Title>
            <Stack gap="sm" mt="xs">
              <Textarea
                label="Deskripsi Tugas"
                value={tugasInstructions}
                onChange={(e) => setTugasInstructions(e.currentTarget.value)}
                minRows={4}
                required
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
        <Title order={3}>Tambah Modul</Title>
      </Group>
      {error && (
        <Alert color="red" mb="md" title="Error">
          {error}
        </Alert>
      )}
      <Card withBorder>
        <Stack>
          <Alert color="blue" title="Perhatian">
            Jenis modul hanya dapat dipilih saat membuat modul baru. Saat edit
            modul nanti, jenis modul tidak dapat diubah.
          </Alert>

          <TextInput
            label="Judul"
            placeholder="Judul modul"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Deskripsi"
            placeholder="Deskripsi (opsional)"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            minRows={3}
          />
          <Radio.Group
            name="module-kind"
            label="Jenis Modul"
            value={moduleKind}
            onChange={setModuleKind}
            withAsterisk
          >
            <Group mt="xs">
              {kinds.map((k) => (
                <Radio key={k.value} value={k.value} label={k.label} />
              ))}
            </Group>
          </Radio.Group>
          <NumberInput
            label="Urutan"
            placeholder="0"
            value={orderIndex}
            onChange={(val) =>
              setOrderIndex(typeof val === "number" ? val : undefined)
            }
            min={1}
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
          {renderExtra()}
          <Group justify="flex-end" mt="md">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              loading={loading}
              onClick={handleCreate}
              disabled={!title}
            >
              Simpan
            </Button>
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}
