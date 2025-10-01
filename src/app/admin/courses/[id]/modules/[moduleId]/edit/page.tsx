/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { DateTimePicker } from "@mantine/dates";

interface QuizQuestion {
  id?: string;
  question: string;
  options?: string[];
  answer?: string | number | string[];
  [key: string]: unknown;
}

interface AssignmentSpec {
  title?: string;
  description?: string;
  due_date?: string | null;
  max_score?: number;
  [key: string]: unknown;
}

interface ModuleFull {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  module_kind: "materi" | "quiz" | "tugas" | "live";
  order_index: number | null;
  is_published: boolean | null;
  content?: string | null;
  quiz_questions?: QuizQuestion[] | null;
  assignment?: AssignmentSpec | null;
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

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState<number | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(true);
  const [content, setContent] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<string>("[]");
  const [assignment, setAssignment] = useState<string>("{}");
  const [, setLiveLink] = useState("");
  const [liveAgenda, setLiveAgenda] = useState("");
  const [liveStartAt, setLiveStartAt] = useState<Date | null>(null);
  const [liveDuration, setLiveDuration] = useState<number>(60);
  const [liveJoinUrl, setLiveJoinUrl] = useState<string>("");
  const [livePasscode, setLivePasscode] = useState<string>("");

  const fetchModule = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/modules/${moduleId}?userId=${adminId}`
      );
      if (!res.ok) throw new Error("Gagal memuat modul");
      const json = await res.json();
      const m: ModuleFull = json.item;
      setModuleData(m);
      setTitle(m.title);
      setDescription(m.description || "");
      setOrderIndex(m.order_index ?? undefined);
      setIsPublished(m.is_published !== false);
      setContent(m.content || "");
      setQuizQuestions(JSON.stringify(m.quiz_questions ?? [], null, 2));
      setAssignment(JSON.stringify(m.assignment ?? {}, null, 2));
      setLiveLink(m.live_session_link || "");
      if ((m as any).live) {
        const lv = (m as any).live as LiveSessionDetail;
        setLiveAgenda(lv.agenda || "");
        setLiveDuration(lv.duration_min ?? 60);
        setLiveJoinUrl(lv.join_url || "");
        // passcode retrieval
        setLivePasscode(lv.passcode || "");
        setLiveStartAt(lv.start_at ? new Date(lv.start_at) : null);
        setLiveLink(lv.join_url || "");
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
        order_index: orderIndex ?? 0,
        is_published: isPublished,
      };
      if (moduleData.module_kind === "materi") body.content = content;
      if (moduleData.module_kind === "quiz") {
        try {
          body.quiz_questions = JSON.parse(quizQuestions || "[]");
        } catch {
          throw new Error("Format quiz questions tidak valid JSON");
        }
      }
      if (moduleData.module_kind === "tugas") {
        try {
          body.assignment = JSON.parse(assignment || "{}");
        } catch {
          throw new Error("Format assignment tidak valid JSON");
        }
      }
      if (moduleData.module_kind === "live") {
        if (!liveAgenda.trim() || !liveStartAt || !liveJoinUrl.trim()) {
          throw new Error("Field wajib live: agenda, waktu mulai, link live");
        }
        // Use flat snake_case like instructor route for consistency
        body.live_agenda = liveAgenda.trim();
        body.live_start_at = liveStartAt.toISOString();
        body.live_join_url = liveJoinUrl.trim();
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
      router.push(`/admin/courses/${courseId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      setError(msg);
    } finally {
      setSaving(false);
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
            <NumberInput
              label="Urutan"
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

            {moduleData.module_kind === "materi" && (
              <Textarea
                label="Konten"
                value={content}
                onChange={(e) => setContent(e.currentTarget.value)}
                minRows={6}
              />
            )}
            {moduleData.module_kind === "quiz" && (
              <Textarea
                label="Quiz Questions (JSON)"
                value={quizQuestions}
                onChange={(e) => setQuizQuestions(e.currentTarget.value)}
                minRows={6}
                description="Array objek pertanyaan"
              />
            )}
            {moduleData.module_kind === "tugas" && (
              <Textarea
                label="Assignment (JSON)"
                value={assignment}
                onChange={(e) => setAssignment(e.currentTarget.value)}
                minRows={6}
                description="Objek assignment"
              />
            )}
            {moduleData.module_kind === "live" && (
              <Card withBorder p="md">
                <Title order={5}>Live Session</Title>
                <Stack gap="sm" mt="xs">
                  <Textarea
                    label="Agenda"
                    value={liveAgenda}
                    onChange={(e) => setLiveAgenda(e.currentTarget.value)}
                    minRows={3}
                  />
                  <DateTimePicker
                    label="Waktu Mulai"
                    value={liveStartAt}
                    onChange={(val: unknown) => {
                      if (val instanceof Date) setLiveStartAt(val);
                      else if (typeof val === "string" && val)
                        setLiveStartAt(new Date(val));
                      else setLiveStartAt(null);
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
            )}

            <Group justify="flex-end" mt="md">
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saving}
                onClick={handleSave}
                disabled={
                  !title ||
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
