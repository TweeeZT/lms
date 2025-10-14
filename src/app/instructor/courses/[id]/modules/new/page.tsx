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
  Divider,
  ActionIcon,
  SimpleGrid,
  Alert,
  Card,
  Text,
} from "@mantine/core";
import { useParams, useRouter } from "next/navigation";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import {
  IconPlus,
  IconTrash,
  IconArrowLeft,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { useAuth } from "../../../../../../hooks/useAuth";
import RichTextEditor from "../../../../../../components/RichTextEditor";

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
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kind
  const validKinds = ["materi", "quiz", "tugas", "live"] as const;
  type ModuleKind = (typeof validKinds)[number];
  const [moduleKind, setModuleKind] = useState<ModuleKind>("materi");

  // Materi content
  const [contentType, setContentType] = useState<"link" | "file" | "text">(
    "link"
  );
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
  // Assignment (simplified: only instructions per current UI)
  const [dueDate] = useState<string>("");
  const [maxScore] = useState<number | "">(100);

  // Live session
  const [liveAgenda, setLiveAgenda] = useState("");
  const [liveStartAt, setLiveStartAt] = useState<Date | null>(null);
  const [liveJoinUrl, setLiveJoinUrl] = useState("");
  const [livePasscode, setLivePasscode] = useState("");

  // addQuestion logic now inline in button handler
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
      let res: Response;
      // Defensive: only allow valid moduleKind values
      const safeKind = validKinds.includes(moduleKind) ? moduleKind : "materi";
      if (safeKind === "materi" && file) {
        const fd = new FormData();
        fd.set("title", title);
        fd.set("description", description);
        fd.set("module_kind", safeKind);
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
          module_kind: safeKind,
          is_published: isPublished,
        };
        if (safeKind === "materi") {
          payload.content = {
            content_type: contentType,
            url: url || undefined,
            text_content: textContent || undefined,
          };
        } else if (safeKind === "quiz") {
          payload.quiz = {
            title: quizTitle,
            passing_score: Number(passingScore || 0),
            time_limit: timeLimit === "" ? undefined : Number(timeLimit),
            questions,
          };
        } else if (safeKind === "tugas") {
          payload.assignment = {
            instructions,
            due_date: dueDate || undefined,
            max_score: Number(maxScore || 100),
          };
        } else if (safeKind === "live") {
          if (
            !liveAgenda ||
            !liveStartAt ||
            !(liveStartAt instanceof Date) ||
            isNaN(liveStartAt.getTime()) ||
            !liveJoinUrl
          ) {
            throw new Error("Agenda, waktu mulai, dan link live wajib diisi");
          }
          payload.live_agenda = liveAgenda;
          // ensure ISO string without milliseconds for consistency
          payload.live_start_at = new Date(liveStartAt.getTime()).toISOString();
          payload.live_join_url = liveJoinUrl.trim();
          if (livePasscode) payload.live_passcode = livePasscode.trim();
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

      notifications.show({
        color: "green",
        title: "Berhasil!",
        message: "Modul berhasil dibuat",
      });

      router.push(`/instructor/courses/${id}`);
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Gagal menyimpan modul";
      if (typeof msg === "string") {
        if (msg.includes("modules_module_kind_check")) {
          msg =
            "Database belum mengizinkan nilai 'live' untuk module_kind. Perbarui CHECK constraint tabel modules agar mencakup 'live'.";
        } else if (msg.includes("toISOString")) {
          msg = "Waktu mulai live tidak valid. Pilih ulang tanggal & waktu.";
        }
      }
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

  if (saving) {
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

  return (
    <Container size="md">
      <Paper p="lg" radius="md" withBorder>
        <Stack>
          <Group mb="md" justify="space-between">
            <Button
              variant="subtle"
              component={Link}
              href={`/instructor/courses/${id}`}
              leftSection={<IconArrowLeft size={16} />}
            >
              Kembali
            </Button>
            <Title order={3}>Tambah Modul</Title>
          </Group>
          {error && (
            <Alert color="red" title="Error" mb="md">
              {error}
            </Alert>
          )}
          <form onSubmit={handleSubmit}>
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
                onChange={(v) => setModuleKind(v as typeof moduleKind)}
                withAsterisk
              >
                <Group mt="xs">
                  <Radio value="materi" label="Materi" />
                  <Radio value="quiz" label="Quiz" />
                  <Radio value="tugas" label="Tugas" />
                  <Radio value="live" label="Live" />
                </Group>
              </Radio.Group>
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
              {moduleKind === "materi" && (
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
                    onChange={(v) =>
                      setContentType((v as typeof contentType) || "link")
                    }
                    required
                  />
                  {contentType === "link" && (
                    <TextInput
                      label="URL"
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => setUrl(e.currentTarget.value)}
                      required
                    />
                  )}
                  {contentType === "text" && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Konten Teks <span style={{ color: "red" }}>*</span>
                      </Text>
                      <RichTextEditor
                        value={textContent}
                        onChange={setTextContent}
                        placeholder="Tulis materi pembelajaran..."
                        minHeight="400px"
                      />
                    </div>
                  )}
                  {contentType === "file" && (
                    <FileInput
                      label="Upload File"
                      placeholder="Pilih file"
                      value={file}
                      onChange={setFile}
                      required
                    />
                  )}
                  {["video", "pdf", "ppt", "image"].includes(contentType) && (
                    <>
                      <FileInput
                        label={`Upload ${contentType.toUpperCase()}`}
                        placeholder={`Pilih ${contentType}`}
                        value={file}
                        onChange={setFile}
                      />
                      <TextInput
                        label="Atau URL (opsional)"
                        placeholder="https://..."
                        value={url}
                        onChange={(e) => setUrl(e.currentTarget.value)}
                      />
                    </>
                  )}
                </Stack>
              )}
              {moduleKind === "quiz" && (
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
                      onChange={(v) =>
                        setTimeLimit(typeof v === "number" ? v : "")
                      }
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
                              {
                                value: "multiple-choice",
                                label: "Multiple Choice",
                              },
                              { value: "true-false", label: "True / False" },
                              {
                                value: "short-answer",
                                label: "Jawaban Singkat",
                              },
                            ]}
                            value={q.q_type}
                            onChange={(v) =>
                              updateQuestion(qi, {
                                q_type:
                                  (v as Question["q_type"]) ||
                                  "multiple-choice",
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
                                  onChange={(e) => {
                                    const next = q.options?.slice() || [];
                                    next[oi] = e.currentTarget.value;
                                    updateQuestion(qi, { options: next });
                                  }}
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
                              updateQuestion(qi, {
                                correct: e.currentTarget.value,
                              })
                            }
                          />
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
                      onClick={() =>
                        setQuestions((q) => [
                          ...q,
                          {
                            question: "",
                            q_type: "multiple-choice",
                            options: ["", "", "", ""],
                            correct: "0",
                          },
                        ])
                      }
                    >
                      Tambah Pertanyaan
                    </Button>
                  </Stack>
                </Stack>
              )}
              {moduleKind === "live" && (
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="sm">
                    <Textarea
                      label="Agenda"
                      value={liveAgenda}
                      onChange={(e) => setLiveAgenda(e.currentTarget.value)}
                      minRows={3}
                      required
                    />
                    <DateTimePicker
                      label="Waktu Mulai"
                      placeholder="Pilih tanggal & waktu"
                      value={liveStartAt}
                      onChange={(val) => {
                        if (!val) {
                          setLiveStartAt(null);
                          return;
                        }
                        // runtime guard: detect Date object via toString tag
                        const isDateObject =
                          Object.prototype.toString.call(val) ===
                          "[object Date]";
                        if (isDateObject) {
                          const d = val as unknown as Date;
                          setLiveStartAt(isNaN(d.getTime()) ? null : d);
                          return;
                        }
                        const parsed = new Date(val as unknown as string);
                        setLiveStartAt(isNaN(parsed.getTime()) ? null : parsed);
                      }}
                      valueFormat="DD/MM/YYYY HH:mm"
                      required
                      clearable
                    />
                    <TextInput
                      required
                      label="Link Live"
                      placeholder="https://..."
                      value={liveJoinUrl}
                      onChange={(e) => setLiveJoinUrl(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Passcode (opsional)"
                      value={livePasscode}
                      onChange={(e) => setLivePasscode(e.currentTarget.value)}
                    />
                  </Stack>
                </Paper>
              )}
              {moduleKind === "tugas" && (
                <Textarea
                  label="Instruksi Tugas"
                  minRows={4}
                  placeholder="Jelaskan tugas..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.currentTarget.value)}
                  required
                />
              )}
              <Group justify="flex-end" mt="md">
                <Button
                  type="submit"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={saving}
                  disabled={
                    !title ||
                    (moduleKind === "live" &&
                      (!liveAgenda || !liveStartAt || !liveJoinUrl))
                  }
                >
                  Simpan
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
