"use client";

import { useState } from "react";
import { Card, Stack, Group, Text, Button, Alert } from "@mantine/core";
import { IconClipboard, IconUpload, IconLink } from "@tabler/icons-react";

interface AssignmentSectionProps {
  assignment: {
    id: string;
    instructions?: string | null;
    dueDate?: string | null;
    maxScore?: string | null;
  };
  onSubmit: (fileUrl: string | null, linkUrl: string | null) => Promise<void>;
  isSubmitted?: boolean;
}

export default function AssignmentSection({
  assignment,
  onSubmit,
  isSubmitted = false,
}: AssignmentSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(isSubmitted);

  const handleSubmit = async () => {
    if (!file && !link) return;
    setUploading(true);
    try {
      // Upload file first if provided
      let fileUrl = "";
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("folder", "assignments");
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
      setSubmitted(true);
    } catch (err) {
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="lg">
        <Group gap="sm">
          <IconClipboard size={28} color="var(--primary-color)" />
          <div>
            <Text size="xl" fw={700}>
              Tugas
            </Text>
            <Text size="sm" c="dimmed">
              Kumpulkan hasil pekerjaan Anda
            </Text>
          </div>
        </Group>

        {assignment.instructions && (
          <Card withBorder p="md" bg="#fafafa">
            <Text size="sm" fw={600} mb="xs">
              Instruksi:
            </Text>
            <div
              dangerouslySetInnerHTML={{ __html: assignment.instructions }}
              style={{ fontSize: 14, lineHeight: 1.6 }}
              className="ql-editor"
            />
          </Card>
        )}

        {assignment.dueDate && (
          <Alert color="orange" title="Batas Waktu">
            <Text size="sm">
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

        {!submitted ? (
          <>
            {/* File Upload */}
            <div>
              <Text size="sm" fw={600} mb="xs">
                Upload File
              </Text>
              <label
                htmlFor="assignFileInput"
                style={{
                  display: "block",
                  padding: 32,
                  border: "2px dashed var(--border-color)",
                  borderRadius: 12,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#fafafa",
                  transition: "all 0.2s ease",
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
                  disabled={uploading || submitted}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.zip,.rar,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.mkv"
                />
                {!file ? (
                  <div>
                    <IconUpload
                      size={48}
                      color="var(--primary-color)"
                      style={{ marginBottom: 8 }}
                    />
                    <Text size="sm" fw={600} c="dimmed">
                      Klik atau seret file ke sini
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      PDF, Gambar, ZIP, Dokumen Office, Video
                    </Text>
                  </div>
                ) : (
                  <div>
                    <Text size="sm" fw={600}>
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
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
                        Hapus
                      </Button>
                    )}
                  </div>
                )}
              </label>
            </div>

            {/* Link Input */}
            <div>
              <Text size="sm" fw={600} mb="xs">
                Atau Link (Opsional)
              </Text>
              <Group gap="xs">
                <IconLink size={20} color="#666" />
                <input
                  type="text"
                  placeholder="https://github.com/... atau https://scratch.mit.edu/..."
                  value={link}
                  disabled={uploading || submitted}
                  onChange={(e) => setLink(e.target.value)}
                  style={{
                    flex: 1,
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 14,
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
              color="green"
              leftSection={<IconUpload size={18} />}
            >
              {file || link ? "Submit Tugas" : "Pilih File atau Masukkan Link"}
            </Button>
          </>
        ) : (
          <Alert color="green" title="✅ Tugas Terkirim">
            <Text size="sm">
              Tugas Anda telah berhasil dikumpulkan. Tunggu penilaian dari
              instruktur.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
