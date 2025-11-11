"use client";

import { useState } from "react";
import {
  Card,
  Stack,
  Title,
  Text,
  Group,
  Badge,
  Modal,
  Button,
  Box,
  Grid,
  Alert,
  Skeleton,
} from "@mantine/core";
import {
  IconTool,
  IconInfoCircle,
  IconCurrencyDollar,
} from "@tabler/icons-react";

type CourseTool = {
  id: string;
  courses_id: string;
  title: string;
  text_content: string;
  price: number;
  created_at: string;
};

type CourseToolsSectionProps = {
  tools: CourseTool[];
  loading?: boolean;
};

export default function CourseToolsSection({
  tools,
  loading = false,
}: CourseToolsSectionProps) {
  const [selectedTool, setSelectedTool] = useState<CourseTool | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const openToolModal = (tool: CourseTool) => {
    setSelectedTool(tool);
    setModalOpened(true);
  };

  // Show skeleton during loading
  if (loading) {
    return (
      <Card withBorder p="xl" radius="lg">
        <Stack gap="lg">
          <Group gap="sm">
            <Skeleton height={52} width={52} radius="md" />
            <div style={{ flex: 1 }}>
              <Skeleton height={28} width={200} mb="xs" />
              <Skeleton height={18} width={300} />
            </div>
          </Group>

          <Grid gutter="md">
            {[1, 2, 3].map((i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
                <Card withBorder padding="lg" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Skeleton height={24} width={80} />
                      <Skeleton height={18} width={18} circle />
                    </Group>
                    <Skeleton height={20} width="100%" />
                    <Skeleton height={16} width="80%" />
                    <Skeleton height={20} width={100} mt="auto" />
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      </Card>
    );
  }

  // Don't show section if no tools
  if (!tools || tools.length === 0) {
    return null;
  }

  return (
    <>
      <Card withBorder p="xl" radius="lg">
        <Stack gap="lg">
          <Group gap="sm">
            <Box
              style={{
                background: "var(--mantine-color-orange-light)",
                padding: 12,
                borderRadius: 12,
              }}
            >
              <IconTool size={28} color="var(--mantine-color-orange-6)" />
            </Box>
            <div>
              <Title order={3}>Alat & Perlengkapan</Title>
              <Text size="sm" c="dimmed">
                Daftar alat dan perlengkapan yang dibutuhkan untuk kursus ini
              </Text>
            </div>
          </Group>

          <Grid gutter="md">
            {tools.map((tool, index) => (
              <Grid.Col key={tool.id} span={{ base: 12, sm: 6, md: 4 }}>
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    height: "100%",
                  }}
                  onClick={() => openToolModal(tool)}
                  className="hover-card"
                >
                  <Stack gap="sm" h="100%">
                    <Group justify="space-between" align="flex-start">
                      <Badge color="orange" variant="light">
                        Alat #{index + 1}
                      </Badge>
                      <IconInfoCircle
                        size={18}
                        color="var(--mantine-color-gray-6)"
                      />
                    </Group>

                    <div style={{ flex: 1 }}>
                      <Text fw={600} size="lg" mb="xs">
                        {tool.title || `Alat ${index + 1}`}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Klik untuk lihat detail perlengkapan
                      </Text>
                    </div>

                    {tool.price > 0 && (
                      <Group gap={6} mt="auto">
                        <IconCurrencyDollar
                          size={16}
                          color="var(--mantine-color-orange-6)"
                        />
                        <Text size="sm" fw={600} c="orange">
                          {formatCurrency(tool.price)}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>

          <Alert
            icon={<IconInfoCircle size={18} />}
            color="blue"
            variant="light"
          >
            <Text size="sm">
              Klik pada kartu alat untuk melihat detail lengkap dan daftar
              perlengkapan yang dibutuhkan.
            </Text>
          </Alert>
        </Stack>
      </Card>

      {/* Detail Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="sm">
            <IconTool size={24} color="var(--mantine-color-orange-6)" />
            <Title order={3}>
              {selectedTool?.title || "Detail Alat & Perlengkapan"}
            </Title>
          </Group>
        }
        size="lg"
        centered
      >
        {selectedTool && (
          <Stack gap="lg">
            <div
              className="tool-content"
              dangerouslySetInnerHTML={{
                __html: selectedTool.text_content,
              }}
              style={{
                fontSize: 15,
                lineHeight: 1.8,
              }}
            />

            {selectedTool.price > 0 && (
              <Card withBorder p="md" bg="#fff9e6">
                <Group gap="sm" justify="space-between">
                  <Group gap="sm">
                    <IconCurrencyDollar
                      size={20}
                      color="var(--mantine-color-orange-6)"
                    />
                    <Text fw={600}>Estimasi Biaya:</Text>
                  </Group>
                  <Text size="lg" fw={700} c="orange">
                    {formatCurrency(selectedTool.price)}
                  </Text>
                </Group>
              </Card>
            )}

            <Button
              variant="light"
              color="orange"
              onClick={() => setModalOpened(false)}
              fullWidth
            >
              Tutup
            </Button>
          </Stack>
        )}
      </Modal>

      <style jsx global>{`
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
        }
        .tool-content ol,
        .tool-content ul {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        .tool-content li {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </>
  );
}
