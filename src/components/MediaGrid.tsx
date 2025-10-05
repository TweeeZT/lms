"use client";

import { useState } from "react";
import { Modal, Image, SimpleGrid, ActionIcon } from "@mantine/core";
import { IconVideo, IconX } from "@tabler/icons-react";

type MediaItem = {
  id: string;
  m_type: "image" | "video";
  url: string;
  thumbnail?: string | null;
};

export function MediaGrid({ media }: { media: MediaItem[] }) {
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [playVideo, setPlayVideo] = useState<string | null>(null);

  if (!media || media.length === 0) return null;

  const handleMediaClick = (item: MediaItem) => {
    if (item.m_type === "video") {
      setPlayVideo(item.url);
    } else {
      setZoomImage(item.url);
    }
  };

  // Tentukan jumlah kolom berdasarkan jumlah media
  const cols = media.length === 1 ? 1 : media.length === 2 ? 2 : 3;

  return (
    <>
      <SimpleGrid cols={cols} spacing="md">
        {media.map((item) => {
          const isVideo = item.m_type === "video";
          // Gunakan placeholder SVG jika video tidak punya thumbnail
          const displaySrc = isVideo
            ? item.thumbnail ||
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%231e3769' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23f6d457' font-size='48' font-family='Arial'%3E▶%3C/text%3E%3C/svg%3E"
            : item.url;

          return (
            <div
              key={item.id}
              style={{
                position: "relative",
                width: "100%",
                paddingBottom: "75%", // 4:3 aspect ratio
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #e9ecef",
                cursor: "pointer",
              }}
              onClick={() => handleMediaClick(item)}
            >
              <Image
                src={displaySrc}
                alt="Media"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {isVideo && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.9)",
                      borderRadius: "50%",
                      width: 56,
                      height: 56,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconVideo size={28} color="#1e3769" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </SimpleGrid>

      {/* Modal for Image Zoom */}
      <Modal
        opened={!!zoomImage}
        onClose={() => setZoomImage(null)}
        size="xl"
        withCloseButton={false}
        centered
        overlayProps={{ opacity: 0.9, blur: 3 }}
        styles={{
          body: { padding: 0 },
          content: { background: "transparent", boxShadow: "none" },
        }}
      >
        <div style={{ position: "relative" }}>
          <ActionIcon
            variant="filled"
            color="dark"
            size="lg"
            radius="xl"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
            }}
            onClick={() => setZoomImage(null)}
          >
            <IconX size={20} />
          </ActionIcon>
          {zoomImage && (
            <Image
              src={zoomImage}
              alt="Zoom"
              fit="contain"
              style={{ maxHeight: "90vh", width: "100%" }}
            />
          )}
        </div>
      </Modal>

      {/* Modal for Video Playback */}
      <Modal
        opened={!!playVideo}
        onClose={() => setPlayVideo(null)}
        size="xl"
        withCloseButton={false}
        centered
        overlayProps={{ opacity: 0.9, blur: 3 }}
        styles={{
          body: { padding: 0 },
          content: { background: "#000", boxShadow: "none" },
        }}
      >
        <div style={{ position: "relative" }}>
          <ActionIcon
            variant="filled"
            color="dark"
            size="lg"
            radius="xl"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
            }}
            onClick={() => setPlayVideo(null)}
          >
            <IconX size={20} />
          </ActionIcon>
          {playVideo && (
            <video
              src={playVideo}
              controls
              autoPlay
              style={{
                width: "100%",
                maxHeight: "90vh",
                display: "block",
              }}
            >
              <track kind="captions" />
            </video>
          )}
        </div>
      </Modal>
    </>
  );
}
