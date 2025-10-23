"use client";

import { useRef, useState } from "react";
import { Modal, Image, ActionIcon, Group, Text } from "@mantine/core";
import { IconVideo, IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

type MediaItem = {
  id: string;
  m_type: "image" | "video";
  url: string;
  thumbnail?: string | null;
};

export function MediaGrid({ media }: { media: MediaItem[] }) {
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [playVideo, setPlayVideo] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (!media || media.length === 0) return null;

  const clamp = (i: number) => (i + media.length) % media.length;
  const goPrev = () => setIndex((i) => clamp(i - 1));
  const goNext = () => setIndex((i) => clamp(i + 1));

  const current = media[index];
  const isVideo = current.m_type === "video";
  const displaySrc = isVideo
    ? current.thumbnail ||
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%231e3769' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23f6d457' font-size='48' font-family='Arial'%3E%E2%96%B6%3C/text%3E%3C/svg%3E"
    : current.url;

  const handleOpen = () => {
    if (isVideo) setPlayVideo(current.url);
    else setZoomImage(current.url);
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) goPrev();
    else goNext();
  };

  return (
    <>
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #e9ecef",
          background: "#0f1f3b",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ position: "relative", width: "100%", paddingBottom: "75%" }}>
          <Image
            src={displaySrc}
            alt={`Media ${index + 1}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              cursor: "pointer",
            }}
            onClick={handleOpen}
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
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: "50%",
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconVideo size={22} color="#1e3769" />
              </div>
            </div>
          )}
        </div>

        {media.length > 1 && (
          <>
            <ActionIcon
              variant="light"
              color="dark"
              radius="xl"
              size="lg"
              style={{ position: "absolute", top: "50%", left: 12, transform: "translateY(-50%)" }}
              onClick={goPrev}
              aria-label="Prev"
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="dark"
              radius="xl"
              size="lg"
              style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)" }}
              onClick={goNext}
              aria-label="Next"
            >
              <IconChevronRight size={20} />
            </ActionIcon>

            <Group gap={6} style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)" }}>
              {media.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setIndex(i)}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: i === index ? "#fff" : "#ffffff99",
                    cursor: "pointer",
                  }}
                />
              ))}
            </Group>

            <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
              {index + 1} / {media.length}
            </div>
          </>
        )}
      </div>

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
