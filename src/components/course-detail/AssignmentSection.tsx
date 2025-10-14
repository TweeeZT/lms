"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Alert,
  Divider,
  Anchor,
  Badge,
} from "@mantine/core";
import {
  IconClipboard,
  IconUpload,
  IconLink,
  IconSend,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

interface AssignmentSectionProps {
  assignment: {
    id: string;
    instructions?: string | null;
    dueDate?: string | null;
    maxScore?: string | null;
    passingGrade?: number;
  };
  onSubmit: (fileUrl: string | null, linkUrl: string | null) => Promise<void>;
  isSubmitted?: boolean;
  submittedInfo?: {
    file_url?: string | null;
    link_url?: string | null;
    note?: string | null;
    score?: number | null;
    status?: string | null;
  } | null;
}

export default function AssignmentSection({
  assignment,
  onSubmit,
  isSubmitted = false,
  submittedInfo,
}: AssignmentSectionProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);

  // Derive status from props
  const currentStatus = submittedInfo?.status;
  const passingGrade = assignment.passingGrade || 70;
  const hasSubmission = !!(submittedInfo?.file_url || submittedInfo?.link_url);

  // Status logic based on status field
  const isWaiting = currentStatus === "waiting";
  const isRejected = currentStatus === "rejected";
  const isGraded = currentStatus === "graded";
  const isPassed = isGraded && (submittedInfo?.score ?? 0) >= passingGrade;
  const isFailed = isGraded && (submittedInfo?.score ?? 0) < passingGrade;

  // Only allow form if: no submission OR rejected OR failed (score < passing)
  const canSubmit = !hasSubmission || isRejected || isFailed;

  const handleSubmit = async () => {
    // Guard: block if already submitted and not rejected
    if (!canSubmit) {
      return;
    }
    if (!file && !link) return;
    if (!user?.id) {
      throw new Error("User tidak ditemukan, silakan login ulang");
    }
    setUploading(true);
    try {
      // Upload file first if provided
      let fileUrl = "";
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("userId", user.id);
        fd.set("bucket", "assignments-submissions");
        const uploadRes = await fetch("/api/storage/upload", {
          method: "POST",
          body: fd,
        });
        const uploadJson = await uploadRes.json();
        if (uploadRes.ok && uploadJson.success) {
          fileUrl = uploadJson.url;
        } else {
          throw new Error(uploadJson.error || "Upload gagal");
        }
      }

      // Now submit to parent with URLs
      await onSubmit(fileUrl || null, link || null);
      // No need to setSubmitted - parent will reload
      setFile(null);
      setLink("");
    } catch (err) {
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack gap="xl">
      <Group gap="md">
        <IconClipboard size={32} color="var(--primary-color)" />
        <div style={{ flex: 1 }}>
          <Text size="xl" fw={700} c="var(--primary-color)">
            Tugas
          </Text>
        </div>
      </Group>

      <Divider />

      {assignment.instructions && (
        <Alert
          color="blue"
          variant="light"
          title="📋 Instruksi Tugas"
          styles={{
            title: { fontSize: 16, fontWeight: 700 },
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: assignment.instructions }}
            style={{ fontSize: 15, lineHeight: 1.7 }}
            className="ql-editor"
          />
        </Alert>
      )}

      {assignment.dueDate && (
        <Alert
          color="orange"
          variant="light"
          styles={{
            message: { fontSize: 15 },
          }}
        >
          <Text size="md" fw={600}>
            ⏰ Batas Waktu:{" "}
            {new Date(assignment.dueDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Alert>
      )}

      {/* Show form if can submit */}
      {canSubmit ? (
        <>
          {/* Jika rejected, tampilkan riwayat dulu */}
          {isRejected && submittedInfo && (
            <Alert
              color="red"
              variant="filled"
              title="❌ Tugas Ditolak"
              styles={{
                title: { fontSize: 17, fontWeight: 700 },
                message: { fontSize: 15 },
              }}
            >
              <Text size="md" mb="sm">
                Tugasmu ditolak oleh instruktur. Silakan perbaiki dan kirim
                ulang.
              </Text>
              {submittedInfo.note && (
                <>
                  <Text size="md" fw={700} mt="md" mb="xs">
                    📝 Catatan Instruktur:
                  </Text>
                  <Text size="md" style={{ whiteSpace: "pre-wrap" }}>
                    {submittedInfo.note}
                  </Text>
                </>
              )}

              {/* Riwayat submission yang ditolak */}
              <Card
                withBorder
                p="md"
                mt="md"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                <Text size="sm" fw={700} mb="xs" c="white">
                  Pengumpulan Sebelumnya:
                </Text>
                {submittedInfo.file_url && (
                  <Group mb="xs">
                    <IconUpload size={16} color="white" />
                    <Anchor
                      href={submittedInfo.file_url}
                      target="_blank"
                      c="white"
                      size="sm"
                    >
                      Lihat File
                    </Anchor>
                  </Group>
                )}
                {submittedInfo.link_url && (
                  <Group>
                    <IconLink size={16} color="white" />
                    <Text
                      size="sm"
                      c="white"
                      style={{ wordBreak: "break-all" }}
                    >
                      {submittedInfo.link_url}
                    </Text>
                  </Group>
                )}
              </Card>
            </Alert>
          )}

          {/* Jika failed (nilai < passing), tampilkan info */}
          {isFailed && submittedInfo && (
            <Alert
              color="orange"
              variant="light"
              title="⚠️ Nilai Belum Mencukupi"
              styles={{
                title: { fontSize: 17, fontWeight: 700 },
                message: { fontSize: 15 },
              }}
            >
              <Text size="md">
                Nilai kamu <strong>{submittedInfo.score}</strong> belum mencapai
                nilai minimum <strong>{passingGrade}</strong>. Kamu dapat
                mengumpulkan tugas ulang untuk memperbaiki nilai.
              </Text>
              {submittedInfo.note && (
                <>
                  <Text size="md" fw={700} mt="md" mb="xs">
                    📝 Catatan Instruktur:
                  </Text>
                  <Text size="md" style={{ whiteSpace: "pre-wrap" }}>
                    {submittedInfo.note}
                  </Text>
                </>
              )}
            </Alert>
          )}

          {(isRejected || isFailed) && (
            <Divider label="Kirim Ulang Tugas" labelPosition="center" />
          )}

          {/* Form Upload */}
          <Stack gap="lg">
            <div>
              <Text size="lg" fw={700} mb="md" c="var(--primary-color)">
                Upload File (Pilih Salah Satu)
              </Text>
              <label
                htmlFor="assignFileInput"
                style={{
                  display: "block",
                  padding: 40,
                  border: "3px dashed var(--border-color)",
                  borderRadius: 16,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#fafafa",
                  transition: "all 0.3s ease",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "var(--primary-color)";
                  e.currentTarget.style.background = "var(--accent-color)";
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.background = "#fafafa";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedFile = e.dataTransfer.files[0];
                  if (droppedFile) setFile(droppedFile);
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.background = "#fafafa";
                }}
              >
                <input
                  id="assignFileInput"
                  type="file"
                  hidden
                  disabled={uploading}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.zip,.rar,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.mkv"
                />
                {!file ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <IconUpload
                      size={40}
                      color="var(--primary-color)"
                      style={{
                        marginBottom: 8,
                      }}
                    />
                    <Text size="sm" fw={600} c="var(--primary-color)">
                      Klik atau Seret File Ke Sini
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      PDF, Gambar, ZIP, Dokumen Office, Video
                    </Text>
                  </div>
                ) : (
                  <div>
                    <Text size="sm" fw={600} c="var(--primary-color)">
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                    {!uploading && (
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        mt="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setFile(null);
                        }}
                      >
                        Hapus File
                      </Button>
                    )}
                  </div>
                )}
              </label>
            </div>

            <div>
              <Text size="lg" fw={700} mb="xs" c="var(--primary-color)">
                Atau Masukkan Link
              </Text>
              <Group gap="xs" wrap="nowrap" align="center">
                <IconLink size={18} color="#666" />
                <input
                  type="text"
                  placeholder="https://github.com/... atau https://scratch.mit.edu/..."
                  value={link}
                  disabled={uploading}
                  onChange={(e) => setLink(e.target.value)}
                  style={{
                    flex: 1,
                    border: "1px solid var(--border-color)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary-color)";
                    e.currentTarget.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                  }}
                />
              </Group>
            </div>

            <Button
              onClick={handleSubmit}
              loading={uploading}
              disabled={!file && !link}
              size="lg"
              fullWidth
              color="var(--primary-color)"
              leftSection={<IconSend size={24} />}
              styles={{
                root: {
                  fontSize: 18,
                  fontWeight: 700,
                  height: 60,
                },
              }}
            >
              {file || link
                ? "Kirim Tugas Sekarang"
                : "Pilih File atau Masukkan Link"}
            </Button>
          </Stack>
        </>
      ) : (
        /* Show status if submission exists (waiting/passed) */
        <Stack gap="lg">
          {/* Status Alert */}
          {isWaiting && (
            <Alert
              color="yellow"
              variant="filled"
              title="⏳ Menunggu Penilaian"
              styles={{
                title: { fontSize: 17, fontWeight: 700 },
                message: { fontSize: 15 },
              }}
            >
              <Text size="md">
                Tugasmu sudah berhasil dikumpulkan. Tunggu penilaian dari
                instruktur.
              </Text>
            </Alert>
          )}

          {isPassed && (
            <Alert
              color="green"
              variant="filled"
              title="✅ Tugas Diterima"
              styles={{
                title: { fontSize: 17, fontWeight: 700 },
                message: { fontSize: 15 },
              }}
            >
              <Text size="md" mb="xs">
                Selamat! Tugasmu diterima dengan nilai{" "}
                <strong>{submittedInfo?.score}</strong>.
              </Text>
              {submittedInfo?.note && (
                <>
                  <Text size="md" fw={700} mt="md" mb="xs">
                    📝 Catatan Instruktur:
                  </Text>
                  <Text size="md" style={{ whiteSpace: "pre-wrap" }}>
                    {submittedInfo.note}
                  </Text>
                </>
              )}
            </Alert>
          )}

          {/* Riwayat Submission */}
          {(submittedInfo?.file_url || submittedInfo?.link_url) && (
            <Card
              withBorder
              p="lg"
              radius="md"
              style={{ background: "#f8f9fa" }}
            >
              <Text size="lg" fw={700} mb="md" c="var(--primary-color)">
                📦 Pengumpulanmu:
              </Text>
              {submittedInfo?.file_url && (
                <Group mb="md">
                  <IconUpload size={20} color="var(--primary-color)" />
                  <Anchor
                    href={submittedInfo.file_url}
                    target="_blank"
                    size="md"
                    c="var(--primary-color)"
                  >
                    Lihat File yang Dikumpulkan
                  </Anchor>
                </Group>
              )}
              {submittedInfo?.link_url && (
                <Group>
                  <IconLink size={20} color="var(--primary-color)" />
                  <Anchor
                    href={submittedInfo.link_url}
                    target="_blank"
                    size="md"
                    c="var(--primary-color)"
                    style={{ wordBreak: "break-all" }}
                  >
                    {submittedInfo.link_url}
                  </Anchor>
                </Group>
              )}
              {isPassed && submittedInfo?.score != null && (
                <Badge size="xl" color="green" variant="filled" mt="md">
                  Nilai: {submittedInfo.score}
                </Badge>
              )}
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  );
}
