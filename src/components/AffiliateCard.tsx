"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Title,
  Text,
  Group,
  Button,
  Stack,
  Badge,
  CopyButton,
  Tooltip,
  ActionIcon,
  Loader,
  Alert,
  SimpleGrid,
  Box,
} from "@mantine/core";
import {
  IconCopy,
  IconCheck,
  IconDiscount,
  IconUsers,
  IconCoin,
  IconTrophy,
  IconReload,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

interface AffiliateCardProps {
  userId: string;
}

interface AffiliateStats {
  signupReferrals: number;
  purchaseReferrals: number;
  totalReferrals: number;
  totalRewardsPoints: number;
  totalRewardsCoins: number;
}

export default function AffiliateCard({ userId }: AffiliateCardProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAffiliateData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/user/affiliate?userId=${userId}`);
      const json = await res.json();

      if (json.success) {
        setAffiliateCode(json.code);
        setStats(json.stats || null);
        setError(null);
      } else {
        setError(json.error || "Gagal memuat data affiliate");
      }
    } catch (err) {
      setError("Gagal memuat data affiliate");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchAffiliateData();
    }
  }, [userId]);

  const handleGenerateCode = async () => {
    try {
      setGenerating(true);
      const res = await fetch("/api/user/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();

      if (json.success) {
        setAffiliateCode(json.code);
        notifications.show({
          color: "green",
          title: json.isNew ? "Kode Berhasil Dibuat!" : "Kode Ditemukan!",
          message: json.isNew
            ? `Kode affiliate Anda: ${json.code}`
            : `Kode affiliate Anda sudah ada: ${json.code}`,
        });
        // Refresh stats
        await fetchAffiliateData();
      } else {
        notifications.show({
          color: "red",
          message: json.error || "Gagal generate kode",
        });
      }
    } catch (err) {
      notifications.show({
        color: "red",
        message: "Gagal generate kode affiliate",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg">
        <Group justify="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Memuat data affiliate...
          </Text>
        </Group>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert color="red" title="Error">
          {error}
        </Alert>
      </Card>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const affiliateLink = affiliateCode
    ? `${baseUrl}/signup?ref=${affiliateCode}`
    : "";

  return (
    <Card withBorder radius="md" p="lg" style={{ background: "#f8f9fa" }}>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4} mb={4}>
              <Group gap="xs">
                <IconDiscount size={24} color="var(--mantine-color-blue-6)" />
                <span>Kode Affiliate Saya</span>
              </Group>
            </Title>
            <Text size="sm" c="dimmed">
              Dapatkan reward dengan mengajak teman mendaftar atau membeli
              kursus!
            </Text>
          </div>
          <Badge size="lg" color="blue" variant="light">
            Aktif
          </Badge>
        </Group>

        {/* Affiliate Code Display or Generate Button */}
        {!affiliateCode ? (
          <Button
            leftSection={<IconDiscount size={18} />}
            onClick={handleGenerateCode}
            loading={generating}
            size="md"
            variant="light"
            color="blue"
          >
            Generate Kode Affiliate
          </Button>
        ) : (
          <Stack gap="sm">
            {/* Code Display with Copy Button */}
            <Box
              style={{
                background: "white",
                border: "2px solid var(--mantine-color-blue-3)",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <Group justify="space-between" align="center">
                <div>
                  <Text size="xs" c="dimmed" mb={2}>
                    Kode Affiliate
                  </Text>
                  <Text fw={700} size="xl" c="blue">
                    {affiliateCode}
                  </Text>
                </div>
                <CopyButton value={affiliateCode}>
                  {({ copied, copy }) => (
                    <Tooltip
                      label={copied ? "Tersalin!" : "Salin Kode"}
                      position="left"
                    >
                      <ActionIcon
                        color={copied ? "green" : "blue"}
                        onClick={copy}
                        variant="light"
                        size="lg"
                      >
                        {copied ? (
                          <IconCheck size={20} />
                        ) : (
                          <IconCopy size={20} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Box>

            {/* Affiliate Link with Copy Button */}
            <Box
              style={{
                background: "white",
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <Group justify="space-between" align="center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" mb={2}>
                    Link Referral
                  </Text>
                  <Text
                    size="sm"
                    c="blue"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {affiliateLink}
                  </Text>
                </div>
                <CopyButton value={affiliateLink}>
                  {({ copied, copy }) => (
                    <Tooltip
                      label={copied ? "Tersalin!" : "Salin Link"}
                      position="left"
                    >
                      <ActionIcon
                        color={copied ? "green" : "gray"}
                        onClick={copy}
                        variant="light"
                        size="md"
                      >
                        {copied ? (
                          <IconCheck size={18} />
                        ) : (
                          <IconCopy size={18} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Box>
          </Stack>
        )}

        {/* Referral Stats */}
        {affiliateCode && stats && (
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Statistik Referral
            </Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4} align="center">
                  <IconUsers size={20} color="var(--mantine-color-blue-6)" />
                  <Text size="xl" fw={700} c="blue">
                    {stats.totalReferrals}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Total Referral
                  </Text>
                </Stack>
              </Card>

              <Card withBorder padding="sm" radius="md">
                <Stack gap={4} align="center">
                  <IconUsers size={20} color="var(--mantine-color-green-6)" />
                  <Text size="xl" fw={700} c="green">
                    {stats.purchaseReferrals}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Pembelian
                  </Text>
                </Stack>
              </Card>

              <Card withBorder padding="sm" radius="md">
                <Stack gap={4} align="center">
                  <IconTrophy size={20} color="var(--mantine-color-orange-6)" />
                  <Text size="xl" fw={700} c="orange">
                    {stats.totalRewardsPoints.toLocaleString()}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Poin Reward
                  </Text>
                </Stack>
              </Card>

              <Card withBorder padding="sm" radius="md">
                <Stack gap={4} align="center">
                  <IconCoin size={20} color="var(--mantine-color-yellow-6)" />
                  <Text size="xl" fw={700} c="yellow">
                    {stats.totalRewardsCoins.toLocaleString()}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Koin Reward
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>
          </Box>
        )}

        {/* Info Box */}
        <Alert color="blue" variant="light" icon={<IconDiscount size={18} />}>
          <Text size="sm">
            <b>Cara Kerja:</b>
            <br />
            • Bagikan kode atau link ke teman
            <br />• Ketika mereka daftar: <b>+1000 poin & +100 koin</b>
            <br />• Ketika mereka beli kursus: <b>
              +1000 poin & +100 koin
            </b>{" "}
            lagi!
          </Text>
        </Alert>

        {/* Refresh Button */}
        {affiliateCode && (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconReload size={16} />}
            onClick={fetchAffiliateData}
            loading={loading}
          >
            Refresh Statistik
          </Button>
        )}
      </Stack>
    </Card>
  );
}
