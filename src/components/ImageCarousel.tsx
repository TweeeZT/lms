"use client";

import { useState } from "react";
import { Card, Image, ActionIcon, Group, Box } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconVideo,
} from "@tabler/icons-react";

type MediaItem = {
  id: string;
  m_type: "image" | "video";
  url: string;
  thumbnail?: string | null;
};

export function ImageCarousel({ media }: { media: MediaItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media || media.length === 0) return null;

  const current = media[activeIndex];
  const isVideo = current.m_type === "video";
  const displaySrc = isVideo ? current.thumbnail || undefined : current.url;

  const goToPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  return (
    <Box style={{ position: "relative", width: "100%" }}>
      {/* Main Image */}
      <Card
        p={0}
        radius="md"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <Image
          src={displaySrc}
          alt="media"
          radius="md"
          style={{
            objectFit: "cover",
            maxHeight: 500,
            width: "100%",
          }}
        />

        {/* Video Indicator */}
        {isVideo && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.5)",
              borderRadius: "50%",
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconVideo size={32} color="#fff" />
          </div>
        )}

        {/* Navigation Arrows */}
        {media.length > 1 && (
          <>
            <ActionIcon
              variant="filled"
              color="dark"
              size="lg"
              radius="xl"
              onClick={goToPrevious}
              style={{
                position: "absolute",
                top: "50%",
                left: 16,
                transform: "translateY(-50%)",
                opacity: 0.8,
              }}
            >
              <IconChevronLeft size="1.5rem" />
            </ActionIcon>
            <ActionIcon
              variant="filled"
              color="dark"
              size="lg"
              radius="xl"
              onClick={goToNext}
              style={{
                position: "absolute",
                top: "50%",
                right: 16,
                transform: "translateY(-50%)",
                opacity: 0.8,
              }}
            >
              <IconChevronRight size="1.5rem" />
            </ActionIcon>
          </>
        )}

        {/* Indicator Dots */}
        {media.length > 1 && (
          <Group
            gap="xs"
            justify="center"
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {media.map((_, index) => (
              <div
                key={index}
                onClick={() => setActiveIndex(index)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    index === activeIndex ? "#fff" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              />
            ))}
          </Group>
        )}

        {/* Counter */}
        {media.length > 1 && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {activeIndex + 1} / {media.length}
          </div>
        )}
      </Card>

      {/* Thumbnail Strip */}
      {media.length > 1 && (
        <Group gap="xs" mt="md" justify="center">
          {media.map((item, index) => (
            <Card
              key={item.id}
              p={0}
              radius="sm"
              withBorder
              onClick={() => setActiveIndex(index)}
              style={{
                cursor: "pointer",
                opacity: index === activeIndex ? 1 : 0.5,
                border:
                  index === activeIndex
                    ? "2px solid var(--primary-color)"
                    : "1px solid #ddd",
                transition: "all 0.3s",
                width: 80,
                height: 80,
                overflow: "hidden",
              }}
            >
              <Image
                src={
                  item.m_type === "video"
                    ? item.thumbnail || undefined
                    : item.url
                }
                alt={`thumbnail ${index + 1}`}
                style={{
                  objectFit: "cover",
                  width: "100%",
                  height: "100%",
                }}
              />
            </Card>
          ))}
        </Group>
      )}
    </Box>
  );
}
