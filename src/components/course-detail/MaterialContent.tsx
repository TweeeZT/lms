"use client";

import { Card, Stack, Group, Text, Button, Alert } from "@mantine/core";
import { IconFileText, IconExternalLink } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import Image from "next/image";

interface MaterialContentProps {
  content: {
    type?: string | null;
    url?: string | null;
    filePath?: string | null;
    text?: string | null;
  };
  onAutoComplete?: () => void;
}

export default function MaterialContent({
  content,
  onAutoComplete,
}: MaterialContentProps) {
  const autoCompletedRef = useRef(false);
  const textContentLoaded = useRef(false);
  const driveContainerRef = useRef<HTMLDivElement | null>(null);
  const fileContainerRef = useRef<HTMLDivElement | null>(null);

  const markCompleteAuto = () => {
    if (!autoCompletedRef.current && onAutoComplete) {
      autoCompletedRef.current = true;
      onAutoComplete();
    }
  };

  // Text Content - auto mark when mounted
  useEffect(() => {
    if (content.type === "text" && content.text && !textContentLoaded.current) {
      textContentLoaded.current = true;
      markCompleteAuto();
    }
  }, [content.type, content.text]);

  // Text Content
  if (content.type === "text" && content.text) {
    return (
      <Card withBorder p="lg" radius="md">
        <Group gap="xs" mb="md">
          <IconFileText size={20} color="var(--primary-color)" />
          <Text fw={600} size="lg">
            Materi Teks
          </Text>
        </Group>
        <div
          dangerouslySetInnerHTML={{ __html: content.text }}
          style={{
            fontSize: 16,
            lineHeight: 1.8,
            color: "#333",
          }}
          className="ql-editor"
        />
      </Card>
    );
  }

  // Link/URL Content
  if (content.type === "link" && content.url) {
    const url = content.url;
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
    const isGoogleDrive = url.includes("drive.google.com");

    if (isYoutube) {
      const extractVideoId = (input: string) => {
        if (input.includes("watch?v=")) {
          return input.split("watch?v=")[1]?.split("&")[0];
        }
        if (input.includes("youtu.be/")) {
          return input.split("youtu.be/")[1]?.split("?")[0];
        }
        if (input.includes("embed/")) {
          return input.split("embed/")[1]?.split("?")[0];
        }
        return undefined;
      };

      const videoId = extractVideoId(url);
      const embedUrl = videoId
        ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
        : url.replace("watch?v=", "embed/");

      return (
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <Group gap="xs">
              <IconFileText size={20} color="var(--primary-color)" />
              <Text fw={600} size="lg">
                Video Pembelajaran
              </Text>
            </Group>
            <div
              style={{
                position: "relative",
                width: "100%",
                paddingTop: "56.25%",
                borderRadius: 12,
                overflow: "hidden",
                background: "#000",
              }}
            >
              <iframe
                src={embedUrl}
                title="YouTube video player"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={markCompleteAuto}
              />
            </div>
          </Stack>
        </Card>
      );
    }

    // Google Drive PDF/Document
    if (isGoogleDrive) {
      let embedUrl = url;

      // Convert Google Drive share link to embed preview
      if (url.includes("/file/d/")) {
        const fileId = url.split("/file/d/")[1]?.split("/")[0];
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      } else if (url.includes("id=")) {
        const fileId = url.split("id=")[1]?.split("&")[0];
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }

      embedUrl = embedUrl.includes("?")
        ? `${embedUrl}&rm=minimal&embedded=true&pli=1`
        : `${embedUrl}?rm=minimal&embedded=true&pli=1`;

      return (
        <Card withBorder p="lg" radius="md">
          <Group gap="xs" mb="md">
            <IconFileText size={20} color="var(--primary-color)" />
            <Text fw={600} size="lg">
              Materi Dokumen
            </Text>
          </Group>
          <div
            style={{
              width: "100%",
              height: 700,
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              overflow: "auto",
              position: "relative",
            }}
            ref={driveContainerRef}
            onContextMenu={(e) => e.preventDefault()}
          >
            <iframe
              src={embedUrl}
              title="Google Drive Document"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
              }}
              onLoad={markCompleteAuto}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              referrerPolicy="no-referrer"
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "0 0 auto 0",
                height: 72,
                zIndex: 2,
                cursor: "default",
                background:
                  "linear-gradient(180deg, rgba(246,248,252,1) 0%, rgba(246,248,252,0.92) 45%, rgba(246,248,252,0) 100%)",
              }}
              onClick={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onWheel={(event) => {
                event.preventDefault();
                driveContainerRef.current?.scrollBy({
                  top: event.deltaY,
                  behavior: "smooth",
                });
              }}
            />
          </div>
        </Card>
      );
    }

    // Non-YouTube, Non-Google Drive: Show button only (no iframe)
    return (
      <Card withBorder p="lg" radius="md">
        <Stack gap="md" align="center">
          <Group gap="xs">
            <IconFileText size={20} color="var(--primary-color)" />
            <Text fw={600} size="lg">
              Materi
            </Text>
          </Group>

          <Text size="sm" c="dimmed" ta="center">
            Silahkan buka materi ini di tab baru untuk melihat materinya.
          </Text>

          <Button
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<IconExternalLink size={18} />}
            size="lg"
            fullWidth
            style={{
              background: "var(--primary-color)",
              color: "white",
              fontWeight: 600,
            }}
            styles={{
              root: {
                "&:hover": {
                  background: "var(--primary-color)",
                  opacity: 0.9,
                },
              },
            }}
            onClick={markCompleteAuto}
          >
            Buka Materi di Tab Baru
          </Button>
        </Stack>
      </Card>
    );
  }

  // PDF/File Content - Use URL from database (Supabase storage)
  if (content.type === "file" && (content.url || content.filePath)) {
    // Prioritize url field (from database), fallback to filePath
    const fileUrl = content.url || content.filePath || "";
    const isPdf = fileUrl.toLowerCase().endsWith(".pdf");

    return (
      <Card withBorder p="lg" radius="md">
        <Group gap="xs" mb="md">
          <IconFileText size={20} color="var(--primary-color)" />
          <Text fw={600} size="lg">
            {isPdf ? "Dokumen PDF" : "File Materi"}
          </Text>
        </Group>
        <div
          style={{
            width: "100%",
            height: 700,
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            overflow: "auto",
            position: "relative",
          }}
          ref={fileContainerRef}
          onContextMenu={(e) => e.preventDefault()}
        >
          <iframe
            src={
              isPdf
                ? `${
                    fileUrl.split("#")[0]
                  }#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
                : fileUrl
            }
            title="File content"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
            }}
            onLoad={markCompleteAuto}
            onContextMenu={(e) => e.preventDefault()}
            referrerPolicy="no-referrer"
          />
          {isPdf && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "0 0 auto 0",
                height: 64,
                zIndex: 2,
                cursor: "not-allowed",
              }}
              onClick={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onWheel={(event) => {
                event.preventDefault();
                fileContainerRef.current?.scrollBy({
                  top: event.deltaY,
                  behavior: "smooth",
                });
              }}
            />
          )}
        </div>
      </Card>
    );
  }

  // PDF/Video/Image specific types - Disable download
  if (
    (content.type === "pdf" ||
      content.type === "video" ||
      content.type === "image") &&
    content.url
  ) {
    return (
      <Card withBorder p="lg" radius="md">
        <Group gap="xs" mb="md">
          <IconFileText size={20} color="var(--primary-color)" />
          <Text fw={600} size="lg">
            {content.type === "pdf"
              ? "Dokumen PDF"
              : content.type === "video"
              ? "Video"
              : "Gambar"}
          </Text>
        </Group>
        <div
          style={{
            width: "100%",
            height: content.type === "image" ? "auto" : 700,
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {content.type === "image" ? (
            <div
              style={{ position: "relative" }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Image
                src={content.url}
                alt="Material"
                width={800}
                height={600}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 8,
                  pointerEvents: "none",
                }}
                onLoad={markCompleteAuto}
              />
            </div>
          ) : (
            <>
              <iframe
                src={`${content.url}${
                  content.type === "pdf"
                    ? "#toolbar=0&navpanes=0&scrollbar=0"
                    : ""
                }`}
                title={`${content.type} content`}
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  pointerEvents: "none",
                }}
                onLoad={markCompleteAuto}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "transparent",
                  pointerEvents: "all",
                }}
                onContextMenu={(e) => e.preventDefault()}
              />
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Alert color="yellow" title="Konten Tidak Tersedia">
      Materi untuk modul ini belum tersedia atau format tidak didukung.
    </Alert>
  );
}
