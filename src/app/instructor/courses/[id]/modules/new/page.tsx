"use client";

import { useState } from "react";
import {
  Container,
  Title,
  TextInput,
  Textarea,
  Select,
  Button,
  Stack,
  Group,
  Paper,
  Radio,
  FileInput,
  NumberInput,
  Checkbox,
  Badge,
} from "@mantine/core";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconChevronLeft,
  IconUpload,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAuth } from "../../../../../../hooks/useAuth";

type Question = {
  question: string;
  q_type: "multiple-choice" | "true-false" | "short-answer";
  options?: string[];
  correct: string; // index as string or text
  explanation?: string;
};

export default function NewModulePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  // Common
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kind
  const [moduleKind, setModuleKind] = useState<"materi" | "quiz" | "tugas">(
    "materi"
  );

  // Materi content
  const [contentType, setContentType] = useState<
    "video" | "pdf" | "ppt" | "image" | "link" | "file" | "text"
  >("link");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");

  // Quiz
  const [quizTitle, setQuizTitle] = useState("");
  const [passingScore, setPassingScore] = useState<number | "">(70);
  const [timeLimit, setTimeLimit] = useState<number | "">(10);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Tugas
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [maxScore, setMaxScore] = useState<number | "">(100);

  const addQuestion = () => {
    setQuestions((qs) => [
      ...qs,
      {
        question: "",
        q_type: "multiple-choice",
        options: ["", "", "", ""],
        correct: "0",
      },
    ]);
  };
  const removeQuestion = (idx: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      // Materi with file => multipart, else json
      let res: Response;
      if (moduleKind === "materi" && file) {
        const fd = new FormData();
        fd.set("title", title);
        fd.set("description", description);
        fd.set("module_kind", moduleKind);
        fd.set("order_index", String(orderIndex));
        fd.set("is_published", String(isPublished));
        fd.set("content_type", contentType);
        if (url) fd.set("url", url);
        if (textContent) fd.set("text_content", textContent);
        fd.set("file", file);
        fd.set("filename", file.name);
        res = await fetch(
          `/api/instructor/courses/${id}/modules?instructorId=${user.id}`,
          {
            method: "POST",
            body: fd,
          }
        );
      } else {
        const payload: Record<string, unknown> = {
          title,
          description,
          module_kind: moduleKind,
          order_index: orderIndex,
          is_published: isPublished,
        };
        if (moduleKind === "materi") {
          payload.content = {
            content_type: contentType,
            url,
            text_content: textContent,
          };
        } else if (moduleKind === "quiz") {
          payload.quiz = {
            title: quizTitle,
            passing_score: Number(passingScore || 0),
            time_limit: timeLimit === "" ? undefined : Number(timeLimit),
            questions,
          };
        } else if (moduleKind === "tugas") {
          payload.assignment = {
            instructions,
            due_date: dueDate || undefined,
            max_score: Number(maxScore || 100),
          };
        }
        res = await fetch(
          `/api/instructor/courses/${id}/modules?instructorId=${user.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menyimpan modul");
      router.push(`/instructor/courses/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan modul");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="md">
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between">
            <Button
              variant="subtle"
              component={Link}
              href={`/instructor/courses/${id}`}
              leftSection={<IconChevronLeft size="1rem" />}
            >
              Kembali
            </Button>
            <Title order={3}>Tambah Modul</Title>
          </Group>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Judul Modul"
                placeholder="Masukkan judul modul"
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
                required
              />

              <Textarea
                label="Deskripsi"
                placeholder="Masukkan deskripsi modul"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                minRows={3}
              />

              <Select
                label="Jenis Modul"
                data={[
                  { value: "materi", label: "Materi" },
                  { value: "quiz", label: "Kuis" },
                  { value: "tugas", label: "Tugas" },
                ]}
                value={moduleKind}
                onChange={(val) => {
                  if (val === "materi" || val === "quiz" || val === "tugas")
                    setModuleKind(val);
                }}
              />

              <Group grow>
                <NumberInput
                  label="Urutan"
                  value={orderIndex}
                  onChange={(v) => setOrderIndex(Number(v || 0))}
                  min={0}
                />
                <Checkbox
                  label="Published"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.currentTarget.checked)}
                />
              </Group>

              {moduleKind === "materi" && (
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="sm">
                    <Radio.Group
                      label="Tipe Konten"
                      value={contentType}
                      onChange={(val: string) => {
                        if (
                          val === "video" ||
                          val === "pdf" ||
                          val === "ppt" ||
                          val === "image" ||
                          val === "link" ||
                          val === "file" ||
                          val === "text"
                        )
                          setContentType(val);
                      }}
                    >
                      <Group>
                        <Radio value="link" label="Link" />
                        <Radio value="file" label="Upload File" />
                        <Radio value="text" label="Teks" />
                        <Radio value="video" label="Video" />
                        <Radio value="pdf" label="PDF" />
                        <Radio value="ppt" label="PPT" />
                        <Radio value="image" label="Gambar" />
                      </Group>
                    </Radio.Group>
                    {contentType === "file" ? (
                      <FileInput
                        label="Upload File"
                        placeholder="Pilih file"
                        value={file}
                        onChange={setFile}
                        leftSection={<IconUpload size={16} />}
                        accept=".pdf,.ppt,.pptx,.mp4,.png,.jpg,.jpeg"
                      />
                    ) : contentType === "text" ? (
                      <Textarea
                        label="Konten Teks"
                        placeholder="Tulis materi teks..."
                        value={textContent}
                        onChange={(e) => setTextContent(e.currentTarget.value)}
                        minRows={4}
                      />
                    ) : (
                      <TextInput
                        label="URL (YouTube, Drive, dll)"
                        placeholder="https://..."
                        value={url}
                        onChange={(e) => setUrl(e.currentTarget.value)}
                      />
                    )}
                  </Stack>
                </Paper>
              )}

              {moduleKind === "quiz" && (
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="sm">
                    <TextInput
                      label="Judul Kuis"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.currentTarget.value)}
                      required
                    />
                    <Group grow>
                      <NumberInput
                        label="Passing Score"
                        value={passingScore}
                        onChange={(v) => setPassingScore(Number(v || 0))}
                        min={0}
                        max={100}
                      />
                      <NumberInput
                        label="Batas Waktu (menit)"
                        value={timeLimit}
                        onChange={(v) => setTimeLimit(Number(v || 0))}
                        min={0}
                      />
                    </Group>
                    <Group justify="space-between" align="center">
                      <Title order={5}>Pertanyaan</Title>
                      <Button
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={addQuestion}
                      >
                        Tambah Pertanyaan
                      </Button>
                    </Group>
                    <Stack>
                      {questions.map((q, idx) => (
                        <Paper key={idx} p="sm" radius="md" withBorder>
                          <Group align="flex-start" justify="space-between">
                            <Stack gap={6} style={{ flex: 1 }}>
                              <TextInput
                                label={`Pertanyaan #${idx + 1}`}
                                value={q.question}
                                onChange={(e) =>
                                  updateQuestion(idx, {
                                    question: e.currentTarget.value,
                                  })
                                }
                              />
                              <Select
                                label="Tipe"
                                data={[
                                  {
                                    value: "multiple-choice",
                                    label: "Pilihan Ganda",
                                  },
                                  { value: "true-false", label: "Benar/Salah" },
                                  {
                                    value: "short-answer",
                                    label: "Esai Singkat",
                                  },
                                ]}
                                value={q.q_type}
                                onChange={(val) =>
                                  val &&
                                  updateQuestion(idx, {
                                    q_type: val as Question["q_type"],
                                  })
                                }
                              />
                              {q.q_type === "multiple-choice" && (
                                <Stack gap={6}>
                                  {(q.options || ["", "", "", ""]).map(
                                    (opt, oIdx) => (
                                      <Group key={oIdx} gap={8} align="end">
                                        <TextInput
                                          style={{ flex: 1 }}
                                          label={`Opsi ${oIdx + 1}`}
                                          value={opt}
                                          onChange={(e) => {
                                            const next = [
                                              ...(q.options || [
                                                "",
                                                "",
                                                "",
                                                "",
                                              ]),
                                            ];
                                            next[oIdx] = e.currentTarget.value;
                                            updateQuestion(idx, {
                                              options: next,
                                            });
                                          }}
                                        />
                                        <Select
                                          label="Kunci"
                                          data={[
                                            { value: "0", label: "0" },
                                            { value: "1", label: "1" },
                                            { value: "2", label: "2" },
                                            { value: "3", label: "3" },
                                          ]}
                                          value={q.correct}
                                          onChange={(val) =>
                                            val &&
                                            updateQuestion(idx, {
                                              correct: val,
                                            })
                                          }
                                        />
                                      </Group>
                                    )
                                  )}
                                </Stack>
                              )}
                              {q.q_type === "true-false" && (
                                <Select
                                  label="Kunci"
                                  data={[
                                    { value: "0", label: "Benar" },
                                    { value: "1", label: "Salah" },
                                  ]}
                                  value={q.correct}
                                  onChange={(val) =>
                                    val && updateQuestion(idx, { correct: val })
                                  }
                                />
                              )}
                              {q.q_type === "short-answer" && (
                                <TextInput
                                  label="Kunci (teks)"
                                  value={q.correct}
                                  onChange={(e) =>
                                    updateQuestion(idx, {
                                      correct: e.currentTarget.value,
                                    })
                                  }
                                />
                              )}
                              <Textarea
                                label="Penjelasan (opsional)"
                                value={q.explanation || ""}
                                onChange={(e) =>
                                  updateQuestion(idx, {
                                    explanation: e.currentTarget.value,
                                  })
                                }
                              />
                            </Stack>
                            <Button
                              color="red"
                              variant="light"
                              onClick={() => removeQuestion(idx)}
                              leftSection={<IconTrash size={14} />}
                            >
                              Hapus
                            </Button>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {moduleKind === "tugas" && (
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="sm">
                    <Textarea
                      label="Instruksi"
                      value={instructions}
                      onChange={(e) => setInstructions(e.currentTarget.value)}
                      minRows={4}
                    />
                    <Group grow>
                      <TextInput
                        label="Batas Waktu (ISO)"
                        placeholder="2025-10-01T23:59:00Z"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.currentTarget.value)}
                      />
                      <NumberInput
                        label="Nilai Maks"
                        value={maxScore}
                        onChange={(v) => setMaxScore(Number(v || 100))}
                        min={1}
                      />
                    </Group>
                  </Stack>
                </Paper>
              )}

              {error && (
                <Badge color="red" variant="light">
                  {error}
                </Badge>
              )}

              <Group justify="flex-end">
                <Button
                  type="submit"
                  className="btn-primary"
                  loading={saving}
                  disabled={saving}
                >
                  Simpan Modul
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
