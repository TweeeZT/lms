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
  Divider,
  SimpleGrid,
  Alert,
  Text,
} from "@mantine/core";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconChevronLeft, IconUpload } from "@tabler/icons-react";
import { useAuth } from "../../../../../../../hooks/useAuth";
import RichTextEditor from "@/components/RichTextEditor";

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
  const [moduleKind, setModuleKind] = useState<
    "materi" | "quiz" | "tugas" | "live"
  >("materi");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Materi
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
  const [maxScore, setMaxScore] = useState<number | "">(100);

  // Live session
  const [liveAgenda, setLiveAgenda] = useState("");
  const [liveStartAt, setLiveStartAt] = useState<Date | null>(null);
  const [liveJoinUrl, setLiveJoinUrl] = useState("");
  const [livePasscode, setLivePasscode] = useState("");
  // Rewards
  const [coins, setCoins] = useState<number | "">(0);
  const [points, setPoints] = useState<number | "">(0);

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
          module_kind: "materi" | "quiz" | "tugas" | "live";
          coins?: number | null;
          points?: number | null;
        };
        setTitle(m.title || "");
        setDescription(m.description || "");
        setOrderIndex(m.order_index || 0);
        setIsPublished(Boolean(m.is_published));
        setModuleKind(m.module_kind);
        setCoins(typeof m.coins === "number" ? m.coins : 0);
        setPoints(typeof m.points === "number" ? m.points : 0);
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
            if (ct === "link" || ct === "file" || ct === "text")
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
              ? q.questions.map((qq) => {
                  let opts: string[] | undefined = undefined;
                  if (qq.options_json != null) {
                    try {
                      // options_json from API could be stringified JSON OR already an array/object (depending on driver casting)
                      const raw: unknown = qq.options_json as unknown;
                      if (typeof raw === "string") {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) opts = parsed.map(String);
                      } else if (Array.isArray(raw)) {
                        opts = (raw as unknown[]).map(String);
                      }
                    } catch (e) {
                      console.warn("Gagal parse options_json", e);
                    }
                  }
                  return {
                    question: qq.question,
                    q_type: qq.q_type,
                    options: opts,
                    correct: String(qq.correct),
                    explanation: qq.explanation || "",
                  } as Question;
                })
              : [];
            setQuestions(qs);
          }
        } else if (m.module_kind === "tugas") {
          const a = json.detail as
            | { instructions?: string; max_score?: number }
            | undefined;
          if (a) {
            setInstructions(a.instructions || "");
            setMaxScore(a.max_score || 100);
          }
        } else if (m.module_kind === "live") {
          const l = json.detail as {
            id: string;
            agenda?: string | null;
            start_at?: string | null;
            join_url?: string | null;
            passcode?: string | null;
            duration_min?: number | null;
            status?: string | null;
            time_zone?: string | null;
          } | null;
          if (l) {
            setLiveAgenda(l.agenda || "");
            setLiveStartAt(
              l.start_at
                ? isNaN(new Date(l.start_at).getTime())
                  ? null
                  : new Date(l.start_at)
                : null
            );
            setLiveJoinUrl(l.join_url || "");
            setLivePasscode(l.passcode || "");
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
        // rewards
        fd.set("coins", String(coins || 0));
        fd.set("points", String(points || 0));
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
        payload.coins = Number(coins || 0);
        payload.points = Number(points || 0);
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
            questions: questions.map((q) => ({
              question: q.question,
              q_type: q.q_type,
              options: q.q_type === "multiple-choice" ? q.options : undefined,
              correct: q.correct,
              explanation: q.explanation || undefined,
            })),
          };
        } else if (moduleKind === "tugas") {
          payload.assignment = {
            instructions,
            max_score: Number(maxScore || 100),
          };
        } else if (moduleKind === "live") {
          if (
            !liveAgenda ||
            !liveStartAt ||
            isNaN(liveStartAt.getTime()) ||
            !liveJoinUrl
          ) {
            throw new Error("Field wajib: agenda, waktu mulai, link live");
          }
          payload.live_agenda = liveAgenda;
          payload.live_start_at = new Date(liveStartAt.getTime()).toISOString();
          payload.live_join_url = liveJoinUrl.trim();
          if (livePasscode) payload.live_passcode = livePasscode.trim();
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

      notifications.show({
        color: "green",
        title: "Berhasil!",
        message: "Modul berhasil diupdate",
      });

      router.push(`/instructor/courses/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal update modul";
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

  if (loading || saving) {
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
                transform="rotate(45 32 32)" />

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
            <Title order={3}>Edit Modul</Title>
          </Group>

          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <Alert color="blue" title="Perhatian">
                Jenis modul ({moduleKind}) tidak dapat diubah saat edit. Jika
                perlu mengubah jenis modul, silakan buat modul baru.
              </Alert>

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

              {moduleKind === "materi" && (
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="sm">
                    <Radio.Group
                      label="Tipe Konten"
                      value={contentType}
                      onChange={(v: string) => {
                        if (v === "link" || v === "file" || v === "text")
                          setContentType(v);
                      }}
                    >
                      <Group>
                        <Radio value="link" label="Link" />
                        <Radio value="file" label="Upload File" />
                        <Radio value="text" label="Teks" />
                      </Group>
                    </Radio.Group>
                    {contentType === "file" ? (
                      <FileInput
                        label="Upload File Baru"
                        placeholder="Pilih file"
                        value={file}
                        onChange={setFile}
                        leftSection={<IconUpload size={16} />}
                        accept=".pdf,.ppt,.pptx,.mp4,.png,.jpg,.jpeg"
                      />
                    ) : contentType === "text" ? (
                      <div>
                        <Text size="sm" fw={500} mb={8}>
                          Konten Teks
                        </Text>
                        <Text size="xs" c="dimmed" mb={8}>
                          {textContent.replace(/<[^>]*>/g, "").length}/65535
                          karakter
                        </Text>
                        <RichTextEditor
                          value={textContent}
                          onChange={(val) => {
                            // Strip HTML to count actual text length
                            const plainText = val.replace(/<[^>]*>/g, "");
                            if (plainText.length <= 65535) {
                              setTextContent(val);
                            }
                          }}
                          placeholder="Tulis materi pembelajaran..."
                          minHeight="400px"
                        />
                      </div>
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
                    <Group justify="space-between">
                      <Title order={5}>Pertanyaan ({questions.length})</Title>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          setQuestions((q) => [
                            ...q,
                            {
                              question: "",
                              q_type: "multiple-choice",
                              options: [""],
                              correct: "0",
                              explanation: "",
                            },
                          ])
                        }
                      >
                        Tambah Pertanyaan
                      </Button>
                    </Group>
                    <Stack gap="md">
                      {questions.map((q, qi) => (
                        <Paper key={qi} p="sm" withBorder radius="md">
                          <Stack gap={6}>
                            <Group justify="space-between" align="flex-start">
                              <TextInput
                                withAsterisk
                                label={`Pertanyaan ${qi + 1}`}
                                value={q.question}
                                onChange={(e) => {
                                  const val = e.currentTarget.value;
                                  setQuestions((prev) =>
                                    prev.map((qq, i) =>
                                      i === qi ? { ...qq, question: val } : qq
                                    )
                                  );
                                }}
                              />
                              <Button
                                size="xs"
                                color="red"
                                variant="subtle"
                                onClick={() =>
                                  setQuestions((prev) =>
                                    prev.filter((_, i) => i !== qi)
                                  )
                                }
                              >
                                Hapus
                              </Button>
                            </Group>
                            <Radio.Group
                              label="Tipe"
                              value={q.q_type}
                              onChange={(v: string) => {
                                if (
                                  v === "multiple-choice" ||
                                  v === "true-false" ||
                                  v === "short-answer"
                                ) {
                                  setQuestions((prev) =>
                                    prev.map((qq, i) =>
                                      i === qi
                                        ? {
                                            ...qq,
                                            q_type: v,
                                            options:
                                              v === "multiple-choice"
                                                ? qq.options &&
                                                  qq.options.length
                                                  ? qq.options
                                                  : ["", ""]
                                                : undefined,
                                            correct: "0",
                                          }
                                        : qq
                                    )
                                  );
                                }
                              }}
                            >
                              <Group>
                                <Radio
                                  value="multiple-choice"
                                  label="Pilihan Ganda"
                                />
                                <Radio value="true-false" label="True/False" />
                                <Radio
                                  value="short-answer"
                                  label="Jawaban Singkat"
                                />
                              </Group>
                            </Radio.Group>
                            {q.q_type === "multiple-choice" && (
                              <Stack gap={4}>
                                {q.options?.map((opt, oi) => (
                                  <Group key={oi} align="flex-end">
                                    <TextInput
                                      label={`Opsi ${oi + 1}`}
                                      value={opt}
                                      onChange={(e) => {
                                        const val = e.currentTarget.value;
                                        setQuestions((prev) =>
                                          prev.map((qq, i) =>
                                            i === qi
                                              ? {
                                                  ...qq,
                                                  options: qq.options?.map(
                                                    (oo, j) =>
                                                      j === oi ? val : oo
                                                  ),
                                                }
                                              : qq
                                          )
                                        );
                                      }}
                                      style={{ flex: 1 }}
                                    />
                                    <Radio
                                      value={String(oi)}
                                      checked={q.correct === String(oi)}
                                      onChange={() =>
                                        setQuestions((prev) =>
                                          prev.map((qq, i) =>
                                            i === qi
                                              ? { ...qq, correct: String(oi) }
                                              : qq
                                          )
                                        )
                                      }
                                      label="Benar"
                                    />
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      color="red"
                                      onClick={() =>
                                        setQuestions((prev) =>
                                          prev.map((qq, i) =>
                                            i === qi
                                              ? {
                                                  ...qq,
                                                  options: (
                                                    qq.options || []
                                                  ).filter((_, j) => j !== oi),
                                                  correct:
                                                    qq.correct === String(oi)
                                                      ? "0"
                                                      : qq.correct,
                                                }
                                              : qq
                                          )
                                        )
                                      }
                                    >
                                      Hapus
                                    </Button>
                                  </Group>
                                ))}
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() =>
                                    setQuestions((prev) =>
                                      prev.map((qq, i) =>
                                        i === qi
                                          ? {
                                              ...qq,
                                              options: [
                                                ...(qq.options || []),
                                                "",
                                              ],
                                            }
                                          : qq
                                      )
                                    )
                                  }
                                >
                                  Tambah Opsi
                                </Button>
                              </Stack>
                            )}
                            {q.q_type === "true-false" && (
                              <Radio.Group
                                label="Jawaban Benar"
                                value={q.correct}
                                onChange={(v: string) =>
                                  setQuestions((prev) =>
                                    prev.map((qq, i) =>
                                      i === qi ? { ...qq, correct: v } : qq
                                    )
                                  )
                                }
                              >
                                <Group>
                                  <Radio value="true" label="True" />
                                  <Radio value="false" label="False" />
                                </Group>
                              </Radio.Group>
                            )}
                            {q.q_type === "short-answer" && (
                              <TextInput
                                label="Jawaban Benar"
                                value={q.correct}
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((qq, i) =>
                                      i === qi
                                        ? {
                                            ...qq,
                                            correct: e.currentTarget.value,
                                          }
                                        : qq
                                    )
                                  )
                                }
                              />
                            )}
                            <Textarea
                              label="Penjelasan (opsional)"
                              minRows={2}
                              value={q.explanation || ""}
                              onChange={(e) =>
                                setQuestions((prev) =>
                                  prev.map((qq, i) =>
                                    i === qi
                                      ? {
                                          ...qq,
                                          explanation: e.currentTarget.value,
                                        }
                                      : qq
                                  )
                                )
                              }
                            />
                          </Stack>
                        </Paper>
                      ))}
                      {questions.length === 0 && (
                        <TextInput
                          readOnly
                          variant="unstyled"
                          value="Belum ada pertanyaan"
                        />
                      )}
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
                      required
                    />
                    <NumberInput
                      label="Nilai Maksimal"
                      value={maxScore}
                      onChange={(v) => setMaxScore(Number(v || 100))}
                      min={1}
                    />
                  </Stack>
                </Paper>
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
                        const isDateObj =
                          Object.prototype.toString.call(val) ===
                          "[object Date]";
                        if (isDateObj) {
                          const d = val as unknown as Date;
                          setLiveStartAt(isNaN(d.getTime()) ? null : d);
                        } else {
                          const parsed = new Date(val as unknown as string);
                          setLiveStartAt(
                            isNaN(parsed.getTime()) ? null : parsed
                          );
                        }
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

              {/* Rewards inputs */}
              <Divider label="Reward" />
              <SimpleGrid cols={2} mt="md">
                <NumberInput
                  label="Koin (coins)"
                  value={coins}
                  onChange={(v) => setCoins(typeof v === "number" ? v : "")}
                  min={0}
                />
                <NumberInput
                  label="Poin (points)"
                  value={points}
                  onChange={(v) => setPoints(typeof v === "number" ? v : "")}
                  min={0}
                />
              </SimpleGrid>

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
                  disabled={
                    saving ||
                    !title ||
                    (moduleKind === "live" &&
                      (!liveAgenda || !liveStartAt || !liveJoinUrl))
                  }
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
