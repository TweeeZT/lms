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
  Switch,
  Badge,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

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
  type ContentType =
    | "link"
    | "file"
    | "text"
    | "video"
    | "pdf"
    | "ppt"
    | "image";
  const [contentType, setContentType] = useState<ContentType>("link");
  const [contentUrl, setContentUrl] = useState("");
  const [contentText, setContentText] = useState("");
  const [contentFile, setContentFile] = useState<File | null>(null);

  // Quiz fields (simplified for admin placeholder; backend admin route currently ignores quiz details)
  const [quizTitle, setQuizTitle] = useState("");
  const [passingScore, setPassingScore] = useState<number | "">(70);
  const [timeLimit, setTimeLimit] = useState<number | "">(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Live session
  const [liveTitle, setLiveTitle] = useState("");
  const [liveAgenda, setLiveAgenda] = useState("");
  const [liveStartAt, setLiveStartAt] = useState<Date | null>(null); // Date picker value

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
          `/api/admin/courses/${courseId}/modules?userId=${adminId}`,
          { method: "POST", body: fd }
        );
      } else {
        const payload: Record<string, unknown> = {
          title,
          description,
          module_kind: moduleKind,
          order_index: orderIndex ?? 0,
          is_published: isPublished,
        };
        if (moduleKind === "materi") {
          payload.content = {
            content_type: contentType,
            url: contentUrl || undefined,
            text_content: contentText || undefined,
          };
        } else if (moduleKind === "quiz") {
          payload.quiz = {
            title: quizTitle,
            passing_score: typeof passingScore === "number" ? passingScore : 0,
            time_limit: typeof timeLimit === "number" ? timeLimit : undefined,
            questions: questions.map((q) => ({
              question: q.question,
              q_type: q.q_type,
              options: q.options,
              correct: q.correct,
              explanation: q.explanation,
            })),
          };
        } else if (moduleKind === "tugas") {
          payload.assignment = {
            instructions: contentText,
            // future: due_date, max_score
          };
        } else if (moduleKind === "live") {
          // Safeguard: liveStartAt must be a valid Date object
          let liveDate: Date | null = null;
          if (liveStartAt instanceof Date) liveDate = liveStartAt;
          else if (typeof liveStartAt === "string") {
            // In some edge cases Mantine DateTimePicker may emit string (SSR hydration issues)
            const parsed = new Date(liveStartAt);
            if (!isNaN(parsed.getTime())) liveDate = parsed;
          }
          if (!liveTitle || !liveAgenda || !liveDate) {
            throw new Error(
              "Field live (Judul Live, Agenda, Waktu Mulai) wajib & waktu harus valid"
            );
          }
          payload.live = {
            title: liveTitle.trim(),
            agenda: liveAgenda.trim(),
            start_at: liveDate.toISOString(),
          };
        }
        res = await fetch(
          `/api/admin/courses/${courseId}/modules?userId=${adminId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        let msg = json.error || "Gagal membuat modul";
        if (typeof msg === "string" && msg.includes("toISOString")) {
          msg =
            "Waktu mulai live tidak valid. Silakan pilih ulang tanggal & waktu.";
        }
        throw new Error(msg);
      }
      router.push(`/admin/courses/${courseId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat modul";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderExtra = () => {
    if (moduleKind === "materi") {
      return (
        <Stack>
          <Select
            label="Tipe Konten"
            data={[
              { value: "link", label: "Link" },
              { value: "file", label: "File" },
              { value: "text", label: "Teks" },
              { value: "video", label: "Video" },
              { value: "pdf", label: "PDF" },
              { value: "ppt", label: "PPT" },
              { value: "image", label: "Gambar" },
            ]}
            value={contentType}
            onChange={(v) => setContentType((v as ContentType) || "link")}
            required
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
            <Textarea
              label="Konten Teks"
              minRows={4}
              value={contentText}
              onChange={(e) => setContentText(e.currentTarget.value)}
              required
            />
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
          {(["video", "pdf", "ppt", "image"] as ContentType[]).includes(
            contentType
          ) && (
            <>
              <FileInput
                label={`Upload ${contentType.toUpperCase()}`}
                placeholder={`Pilih ${contentType}`}
                value={contentFile}
                onChange={setContentFile}
              />
              <TextInput
                label="Atau URL (opsional)"
                placeholder="https://..."
                value={contentUrl}
                onChange={(e) => setContentUrl(e.currentTarget.value)}
              />
            </>
          )}
        </Stack>
      );
    }
    if (moduleKind === "quiz") {
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
              onChange={(v) => setPassingScore(typeof v === "number" ? v : "")}
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
                        updateQuestion(qi, { question: e.currentTarget.value })
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
                  <TextInput
                    label={
                      q.q_type === "multiple-choice"
                        ? "Jawaban Benar (index)"
                        : "Jawaban Benar"
                    }
                    value={q.correct}
                    onChange={(e) =>
                      updateQuestion(qi, { correct: e.currentTarget.value })
                    }
                  />
                  <Textarea
                    label="Penjelasan (opsional)"
                    value={q.explanation || ""}
                    onChange={(e) =>
                      updateQuestion(qi, { explanation: e.currentTarget.value })
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
    }
    if (moduleKind === "live") {
      return (
        <Stack>
          <TextInput
            label="Judul Live"
            value={liveTitle}
            onChange={(e) => setLiveTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Agenda"
            minRows={3}
            value={liveAgenda}
            onChange={(e) => setLiveAgenda(e.currentTarget.value)}
            required
          />
          <DateTimePicker
            label="Waktu Mulai"
            placeholder="Pilih tanggal & waktu"
            value={liveStartAt}
            onChange={(v) => setLiveStartAt(v as Date | null)}
            valueFormat="DD MMM YYYY HH:mm"
            required
          />
          <Badge variant="light" color="blue">
            Link meeting akan dibuat otomatis saat disimpan.
          </Badge>
          <Switch
            label="Published"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.currentTarget.checked)}
          />
        </Stack>
      );
    }
    if (moduleKind === "tugas") {
      return (
        <Textarea
          label="Instruksi Tugas"
          minRows={4}
          placeholder="Jelaskan tugas..."
          value={contentText}
          onChange={(e) => setContentText(e.currentTarget.value)}
          required
        />
      );
    }
    return null;
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
            min={0}
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
