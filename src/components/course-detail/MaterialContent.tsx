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

  const markCompleteAuto = () => {
    if (!autoCompletedRef.current && onAutoComplete) {
      autoCompletedRef.current = true;
      onAutoComplete();
    }
  };

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
      let embedUrl = url;
      if (url.includes("watch?v=")) {
        const videoId = url.split("watch?v=")[1]?.split("&")[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (url.includes("youtu.be/")) {
        const videoId = url.split("youtu.be/")[1]?.split("?")[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      }

      return (
        <Card withBorder p="lg" radius="md">
          <Group gap="xs" mb="md">
            <IconFileText size={20} color="var(--primary-color)" />
            <Text fw={600} size="lg">
              Video Pembelajaran
            </Text>
          </Group>
          <div
            style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              overflow: "hidden",
              borderRadius: 8,
            }}
          >
            <iframe
              src={embedUrl}
              title="YouTube video"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
                borderRadius: 8,
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={markCompleteAuto}
            />
          </div>
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
              overflow: "hidden",
            }}
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
            />
          </div>
        </Card>
      );
    }

    // Non-YouTube, Non-Google Drive: iframe + external link
    return (
      <Card withBorder p="lg" radius="md">
        <Group gap="xs" mb="md">
          <IconFileText size={20} color="var(--primary-color)" />
          <Text fw={600} size="lg">
            Materi External
          </Text>
        </Group>
        <div
          style={{
            width: "100%",
            height: 600,
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <iframe
            src={url}
            title="External content"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
            }}
            onLoad={markCompleteAuto}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>
      </Card>
    );
  }

  // PDF/File Content - Disable download
  if (content.type === "file" && content.filePath) {
    return (
      <Card withBorder p="lg" radius="md">
        <Group gap="xs" mb="md">
          <IconFileText size={20} color="var(--primary-color)" />
          <Text fw={600} size="lg">
            File Materi
          </Text>
        </Group>
        <div
          style={{
            width: "100%",
            height: 700,
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <iframe
            src={content.filePath}
            title="File content"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
            }}
            onLoad={markCompleteAuto}
            sandbox="allow-same-origin allow-scripts"
          />
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
          }}
        >
          {content.type === "image" ? (
            <Image
              src={content.url}
              alt="Material"
              width={800}
              height={600}
              style={{ width: "100%", height: "auto", borderRadius: 8 }}
              onLoad={markCompleteAuto}
            />
          ) : (
            <iframe
              src={content.url}
              title={`${content.type} content`}
              style={{
                width: "100%",
                height: "100%",
                border: 0,
              }}
              onLoad={markCompleteAuto}
              sandbox="allow-same-origin allow-scripts"
            />
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
