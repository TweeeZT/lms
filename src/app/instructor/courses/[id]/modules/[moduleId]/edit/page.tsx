"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Title,
  TextInput,
  Textarea,
  Button,
  Stack,
  Group,
  Paper,
  Radio,
  FileInput,
  NumberInput,
  Checkbox,
} from "@mantine/core";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { IconChevronLeft, IconUpload } from "@tabler/icons-react";
import { useAuth } from "../../../../../../../hooks/useAuth";

type Question = {
  question: string;
  q_type: "multiple-choice" | "true-false" | "short-answer";
  options?: string[];
  correct: string; // index as string or text
  explanation?: string;
};

export default function EditModulePage() {
  const { id, moduleId } = useParams<{ id: string; moduleId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  // Common
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [moduleKind, setModuleKind] = useState<"materi" | "quiz" | "tugas">(
    "materi"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Materi
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

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/instructor/modules/${moduleId}?instructorId=${user.id}`
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat modul");
        if (!active) return;
        const m = json.item as {
          id: string;
          course_id: string;
          title: string;
          description: string | null;
          order_index: number;
          is_published: boolean | null;
          module_kind: "materi" | "quiz" | "tugas";
        };
        setTitle(m.title || "");
        setDescription(m.description || "");
        setOrderIndex(m.order_index || 0);
        setIsPublished(Boolean(m.is_published));
        setModuleKind(m.module_kind);
        if (m.module_kind === "materi") {
          const contentArr = json.detail as Array<{
            id: string;
            content_type: string;
            url?: string | null;
            file_path?: string | null;
            text_content?: string | null;
          }>;
          const content = Array.isArray(contentArr) ? contentArr[0] : undefined;
          if (content) {
            const ct = content.content_type as string;
            if (
              ct === "video" ||
              ct === "pdf" ||
              ct === "ppt" ||
              ct === "image" ||
              ct === "link" ||
              ct === "file" ||
              ct === "text"
            )
              setContentType(ct);
            setUrl(content.url || "");
            setTextContent(content.text_content || "");
          }
        } else if (m.module_kind === "quiz") {
          const q = json.detail as
            | {
                id: string;
                title: string;
                passing_score: number;
                time_limit?: number | null;
                questions?: Array<{
                  id: string;
                  question: string;
                  q_type: "multiple-choice" | "true-false" | "short-answer";
                  options_json?: string | null;
                  correct: string | number;
                  explanation?: string | null;
                }>;
              }
            | undefined;
          if (q) {
            setQuizTitle(q.title || "");
            setPassingScore(q.passing_score || 70);
            setTimeLimit(q.time_limit || 10);
            const qs = Array.isArray(q.questions)
              ? q.questions.map((qq) => ({
                  question: qq.question,
                  q_type: qq.q_type,
                  options: qq.options_json
                    ? JSON.parse(qq.options_json)
                    : undefined,
                  correct: String(qq.correct),
                  explanation: qq.explanation || "",
                }))
              : [];
            setQuestions(qs);
          }
        } else if (m.module_kind === "tugas") {
          const a = json.detail as
            | { instructions?: string; due_date?: string; max_score?: number }
            | undefined;
          if (a) {
            setInstructions(a.instructions || "");
            setDueDate(a.due_date || "");
            setMaxScore(a.max_score || 100);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [moduleId, user?.id]);

  // Question editing UI omitted in edit-page to keep it simple

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const baseUrl = `/api/instructor/modules/${moduleId}?instructorId=${user.id}`;
      // Update basic fields and kind-specific content
      if (moduleKind === "materi" && file) {
        const fd = new FormData();
        fd.set("title", title);
        fd.set("description", description);
        fd.set("order_index", String(orderIndex));
        fd.set("is_published", String(isPublished));
        fd.set("content_type", contentType);
        if (url) fd.set("url", url);
        if (textContent) fd.set("text_content", textContent);
        fd.set("file", file);
        fd.set("filename", file.name);
        const res = await fetch(baseUrl, { method: "PATCH", body: fd });
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal update modul");
      } else {
        const payload: Record<string, unknown> = {
          title,
          description,
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
        const res = await fetch(baseUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal update modul");
      }
      router.push(`/instructor/courses/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update modul");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="md">
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="lg">
          {loading && (
            <TextInput readOnly variant="unstyled" value="Memuat modul..." />
          )}
          <Group justify="space-between">
            <Button
              variant="subtle"
              component={Link}
              href={`/instructor/courses/${id}`}
              leftSection={<IconChevronLeft size="1rem" />}
            >
              Kembali
            </Button>
            <Title order={3}>Edit Modul</Title>
          </Group>

          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <TextInput
                label="Judul Modul"
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
                required
              />
              <Textarea
                label="Deskripsi"
                minRows={3}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
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
                      onChange={(v: string) => {
                        if (
                          v === "video" ||
                          v === "pdf" ||
                          v === "ppt" ||
                          v === "image" ||
                          v === "link" ||
                          v === "file" ||
                          v === "text"
                        )
                          setContentType(v);
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
                        label="Upload File Baru (opsional)"
                        placeholder="Pilih file"
                        value={file}
                        onChange={setFile}
                        leftSection={<IconUpload size={16} />}
                        accept=".pdf,.ppt,.pptx,.mp4,.png,.jpg,.jpeg"
                      />
                    ) : contentType === "text" ? (
                      <Textarea
                        label="Konten Teks"
                        value={textContent}
                        onChange={(e) => setTextContent(e.currentTarget.value)}
                        minRows={4}
                      />
                    ) : (
                      <TextInput
                        label="URL"
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
                    {/* Questions editing */}
                    {/* Simplified: show counts only; for brevity we keep add/remove minimal here */}
                    <TextInput
                      readOnly
                      label="Jumlah pertanyaan"
                      value={String(questions.length)}
                    />
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
                <TextInput
                  readOnly
                  variant="unstyled"
                  styles={{ input: { color: "red" } }}
                  value={error}
                />
              )}

              <Group justify="flex-end">
                <Button
                  type="submit"
                  className="btn-primary"
                  loading={saving}
                  disabled={saving}
                >
                  Update Modul
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
