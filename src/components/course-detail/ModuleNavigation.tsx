"use client";

import { Stack, Card, Group, Text, Badge, Progress, Box } from "@mantine/core";
import {
  IconFileText,
  IconListCheck,
  IconClipboard,
  IconVideo,
  IconCircleCheck,
  IconLock,
} from "@tabler/icons-react";

type ModuleItem = {
  id: string;
  title: string;
  kind: string;
  order: number;
  isCompleted: boolean;
};

interface ModuleNavigationProps {
  modules: ModuleItem[];
  currentId: string | null;
  onSelectModule: (id: string) => void;
  completionPercentage: number;
}

const MODULE_ICONS = {
  materi: IconFileText,
  quiz: IconListCheck,
  tugas: IconClipboard,
  live: IconVideo,
};

const MODULE_COLORS = {
  materi: "blue",
  quiz: "grape",
  tugas: "orange",
  live: "red",
};

export default function ModuleNavigation({
  modules,
  currentId,
  onSelectModule,
  completionPercentage,
}: ModuleNavigationProps) {
  // Filter out live modules - they will be shown separately
  const regularModules = modules.filter((m) => m.kind !== "live");
  const completedCount = regularModules.filter((m) => m.isCompleted).length;

  return (
    <Card withBorder p="lg" radius="md" style={{ position: "sticky", top: 20 }}>
      <Stack gap="md">
        <div>
          <Text size="lg" fw={700} mb="xs">
            Progres Kursus
          </Text>
          <Progress
            value={completionPercentage}
            size="lg"
            radius="xl"
            color="blue"
            mb="xs"
          />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {completedCount} dari {regularModules.length} modul
            </Text>
            <Text size="sm" fw={600} c="blue">
              {Math.round(completionPercentage)}%
            </Text>
          </Group>
        </div>

        <div>
          <Text size="sm" fw={600} mb="sm" c="dimmed">
            DAFTAR MODUL
          </Text>
          <Stack gap="xs">
            {regularModules.map((module, idx) => {
              const Icon =
                MODULE_ICONS[module.kind as keyof typeof MODULE_ICONS] ||
                IconFileText;
              const color =
                MODULE_COLORS[module.kind as keyof typeof MODULE_COLORS] ||
                "gray";
              const isActive = module.id === currentId;
              const isLocked = idx > 0 && !regularModules[idx - 1].isCompleted;

              return (
                <Box
                  key={module.id}
                  onClick={() => !isLocked && onSelectModule(module.id)}
                  style={{
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.5 : 1,
                    padding: 12,
                    borderRadius: 8,
                    border: isActive
                      ? "2px solid var(--primary-color)"
                      : "1px solid var(--border-color)",
                    background: isActive
                      ? "var(--accent-color)"
                      : module.isCompleted
                      ? "#f0fdf4"
                      : "white",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isLocked && !isActive) {
                      e.currentTarget.style.borderColor =
                        "var(--primary-color)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: module.isCompleted
                          ? "#10b981"
                          : isActive
                          ? "var(--primary-color)"
                          : "var(--hover-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {module.isCompleted ? (
                        <IconCircleCheck size={20} color="white" />
                      ) : isLocked ? (
                        <IconLock size={18} color="#999" />
                      ) : (
                        <Icon size={18} color={isActive ? "white" : "#666"} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        size="sm"
                        fw={isActive ? 600 : 500}
                        lineClamp={2}
                        style={{ wordBreak: "break-word" }}
                      >
                        {module.order}. {module.title}
                      </Text>
                      <Badge
                        size="xs"
                        color={color}
                        variant="light"
                        mt={4}
                        style={{ textTransform: "capitalize" }}
                      >
                        {module.kind}
                      </Badge>
                    </div>
                  </Group>
                </Box>
              );
            })}
          </Stack>
        </div>
      </Stack>
    </Card>
  );
}
