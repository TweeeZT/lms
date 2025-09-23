"use client";

import { useMemo, useState } from "react";
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Avatar,
  TextInput,
  Button,
  Grid,
  Badge,
  Progress,
  Modal,
  Textarea,
} from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { dummyCourses } from "../../../data/courses";
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCertificate,
  IconArrowLeft,
  IconCalendar,
  IconAward,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { transactionsSeed } from "../../../data/finance";
import Image from "next/image";

export default function UserProfilePage() {
  const { user } = useAuth();
  const params = useSearchParams();
  const activeTab = useMemo(() => {
    const t = params?.get("tab") as
      | "profile"
      | "achievements"
      | "purchases"
      | "certificates"
      | null;
    return t ?? "profile";
  }, [params]);
  const [hoveredCert, setHoveredCert] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState<string | null>(null);

  if (!user) return null;

  // Sample data
  const level = user.level ?? 1;
  const currentXP = 1280; // demo XP
  const totalPoints = user.points ?? 0;
  const nextLevelXP = 1500;

  const completedCourses = dummyCourses.slice(0, 1);
  const certificates = completedCourses.map((course) => ({
    id: course.id,
    courseTitle: course.title,
    date: course.updatedAt?.toISOString?.() || new Date().toISOString(),
    url: "/certificate_template.png",
  }));

  const latestPaid = transactionsSeed
    .filter((t) => t.status === "paid")
    .slice(-5)
    .reverse();

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  // Achievement hero requirement targets
  const XP_GOAL = 1000;
  const POINTS_GOAL = 2000;
  const COURSES_GOAL = 2;

  const xpAchieved = currentXP >= XP_GOAL;
  const pointsAchieved = totalPoints >= POINTS_GOAL;
  const coursesAchieved = completedCourses.length >= COURSES_GOAL;

  return (
    <Container size="xl" py="xl" style={{ position: "relative", zIndex: 1 }}>
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="white"
          color="dark"
          component="a"
          href="/user/dashboard"
          size="md"
          radius="xl"
          style={{ fontWeight: 500 }}
        >
          Kembali ke Dashboard
        </Button>
      </Group>

      {/* Profile summary */}
      <Card
        radius="xl"
        p="xl"
        mb="xl"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.5)",
        }}
      >
        <Group>
          <Avatar
            size={110}
            radius="xl"
            src={user.avatar}
            style={{ border: "4px solid var(--primary-color)" }}
          >
            {user.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <Title order={2} c="var(--primary-color)" mb={6}>
              {user.fullName}
            </Title>
            <Group gap="md" mb="sm">
              <Badge
                variant="gradient"
                gradient={{
                  from: "var(--primary-color)",
                  to: "var(--secondary-color)",
                }}
                radius="xl"
              >
                Level {level}
              </Badge>
              <Badge color="green" variant="light" radius="xl">
                {totalPoints} Points
              </Badge>
            </Group>
            <Group gap="xl">
              <div>
                <Text size="lg" fw={700} c="var(--primary-color)">
                  {currentXP}
                </Text>
                <Text size="sm" c="dimmed">
                  Total XP
                </Text>
              </div>
              <div>
                <Text size="lg" fw={700} c="var(--primary-color)">
                  {certificates.length}
                </Text>
                <Text size="sm" c="dimmed">
                  Sertifikat
                </Text>
              </div>
              <div>
                <Text size="lg" fw={700} c="var(--primary-color)">
                  {completedCourses.length}
                </Text>
                <Text size="sm" c="dimmed">
                  Kursus Selesai
                </Text>
              </div>
            </Group>
          </div>
        </Group>
      </Card>

      {/* Tabs moved to left AppShell navbar via ProfileTabsNavbar */}

      {/* Content */}
      <Card
        radius="xl"
        p="xl"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
        }}
      >
        {activeTab === "profile" && (
          <Stack gap="xl">
            <Title order={3} c="var(--primary-color)">
              Edit Profil
            </Title>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Nama Lengkap"
                  leftSection={<IconUser size={16} />}
                  value={fullName}
                  onChange={(e) => setFullName(e.currentTarget.value)}
                  radius="md"
                  size="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  radius="md"
                  size="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Email"
                  leftSection={<IconMail size={16} />}
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  radius="md"
                  size="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Telepon"
                  leftSection={<IconPhone size={16} />}
                  value={phone}
                  onChange={(e) => setPhone(e.currentTarget.value)}
                  radius="md"
                  size="md"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.currentTarget.value)}
                  rows={4}
                  radius="md"
                  size="md"
                />
              </Grid.Col>
            </Grid>
            <Group justify="end">
              <Button variant="light" radius="xl">
                Reset
              </Button>
              <Button
                variant="gradient"
                gradient={{
                  from: "var(--primary-color)",
                  to: "var(--secondary-color)",
                }}
                radius="xl"
              >
                Simpan Perubahan
              </Button>
            </Group>
          </Stack>
        )}

        {activeTab === "achievements" && (
          <Stack gap="xl">
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} c="var(--primary-color)">
                  Pencapaian
                </Title>
                <Text c="dimmed">
                  Target spesial untuk jadi Hero Pembelajar
                </Text>
              </div>
              <Badge variant="light" color="indigo" radius="xl">
                {currentXP}/{nextLevelXP} XP ke level berikutnya
              </Badge>
            </Group>

            {/* Achievements Hero */}
            <Card withBorder radius="xl" p="lg" className="card-hover">
              <Group align="center" wrap="nowrap">
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--primary-color), var(--secondary-color))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    src="/rewards/hero.png"
                    alt="Hero"
                    width={90}
                    height={90}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <Title order={4} c="var(--primary-color)" mb={6}>
                    Hero Challenge
                  </Title>
                  <Text c="dimmed" mb="md">
                    Penuhi ketiga syarat untuk meraih gelar Hero: 1000 XP, 2000
                    Points, dan menyelesaikan 2 kursus.
                  </Text>

                  <Stack gap={10} style={{ maxWidth: 720 }}>
                    {/* XP */}
                    <Group justify="space-between" gap="sm">
                      <Group gap={6}>
                        {xpAchieved ? (
                          <IconCheck size={18} color="green" />
                        ) : (
                          <IconX size={18} color="orange" />
                        )}
                        <Text size="sm">Capai 1000 XP</Text>
                      </Group>
                      <Text
                        size="sm"
                        fw={600}
                        c={xpAchieved ? "green" : "orange"}
                      >
                        {Math.min(currentXP, XP_GOAL)}/{XP_GOAL}
                      </Text>
                    </Group>
                    <Progress
                      value={Math.min(100, (currentXP / XP_GOAL) * 100)}
                      radius="xl"
                      color={xpAchieved ? "green" : "orange"}
                    />

                    {/* Points */}
                    <Group justify="space-between" gap="sm">
                      <Group gap={6}>
                        {pointsAchieved ? (
                          <IconCheck size={18} color="green" />
                        ) : (
                          <IconX size={18} color="orange" />
                        )}
                        <Text size="sm">Kumpulkan 2000 Points</Text>
                      </Group>
                      <Text
                        size="sm"
                        fw={600}
                        c={pointsAchieved ? "green" : "orange"}
                      >
                        {Math.min(totalPoints, POINTS_GOAL)}/{POINTS_GOAL}
                      </Text>
                    </Group>
                    <Progress
                      value={Math.min(100, (totalPoints / POINTS_GOAL) * 100)}
                      radius="xl"
                      color={pointsAchieved ? "green" : "orange"}
                    />

                    {/* Courses */}
                    <Group justify="space-between" gap="sm">
                      <Group gap={6}>
                        {coursesAchieved ? (
                          <IconCheck size={18} color="green" />
                        ) : (
                          <IconX size={18} color="orange" />
                        )}
                        <Text size="sm">Selesaikan 2 Kursus</Text>
                      </Group>
                      <Text
                        size="sm"
                        fw={600}
                        c={coursesAchieved ? "green" : "orange"}
                      >
                        {Math.min(completedCourses.length, COURSES_GOAL)}/
                        {COURSES_GOAL}
                      </Text>
                    </Group>
                    <Progress
                      value={Math.min(
                        100,
                        (completedCourses.length / COURSES_GOAL) * 100
                      )}
                      radius="xl"
                      color={coursesAchieved ? "green" : "orange"}
                    />
                  </Stack>
                </div>
              </Group>
            </Card>

            {/* Level progress */}
            <Card
              withBorder
              radius="xl"
              p="lg"
              style={{ background: "#f8fafc" }}
            >
              <Group justify="space-between" mb="xs">
                <Text fw={600}>Menuju Level {level + 1}</Text>
                <Text fw={700} c="var(--primary-color)">
                  {Math.round((currentXP / nextLevelXP) * 100)}%
                </Text>
              </Group>
              <Progress
                value={(currentXP / nextLevelXP) * 100}
                radius="xl"
                size="lg"
                styles={{
                  section: {
                    background:
                      "linear-gradient(90deg, var(--primary-color), var(--secondary-color))",
                  },
                }}
              />
              <Text size="sm" c="dimmed" mt={6}>
                {nextLevelXP - currentXP} XP lagi untuk naik level
              </Text>
            </Card>
          </Stack>
        )}

        {activeTab === "purchases" && (
          <Stack gap="lg">
            <Title order={3} c="var(--primary-color)">
              Riwayat Pembelian
            </Title>
            {latestPaid.map((t) => (
              <Card
                key={t.id}
                withBorder
                radius="md"
                p="lg"
                className="card-hover"
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={600} mb={6}>
                      {t.courseTitle}
                    </Text>
                    <Group gap="xs">
                      <IconCalendar size={16} color="var(--primary-color)" />
                      <Text size="sm" c="dimmed">
                        {new Date(t.date).toLocaleDateString("id-ID", {
                          dateStyle: "long",
                        })}
                      </Text>
                    </Group>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Text fw={700} size="lg" c="green">
                      {formatCurrency(t.amount)}
                    </Text>
                    <Badge color="green" variant="light" radius="xl">
                      Berhasil
                    </Badge>
                  </div>
                </Group>
              </Card>
            ))}
            {latestPaid.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                Belum ada riwayat pembelian
              </Text>
            )}
          </Stack>
        )}

        {activeTab === "certificates" && (
          <Stack gap="lg">
            <Title order={3} c="var(--primary-color)">
              Sertifikat Kursus
            </Title>
            <Grid gutter="lg">
              {certificates.map((cert) => (
                <Grid.Col key={cert.id} span={{ base: 12, md: 6 }}>
                  <Card withBorder radius="xl" p="lg" className="card-hover">
                    <Stack gap="md">
                      <Group justify="space-between">
                        <div>
                          <Title order={4} c="var(--primary-color)">
                            {cert.courseTitle}
                          </Title>
                          <Group gap="xs" mt={6}>
                            <IconCalendar size={16} />
                            <Text size="sm" c="dimmed">
                              {new Date(cert.date).toLocaleDateString("id-ID")}
                            </Text>
                          </Group>
                        </div>
                        <IconAward size={32} color="var(--secondary-color)" />
                      </Group>

                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: 200,
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setModalImg(cert.url);
                          setModalOpen(true);
                        }}
                        onMouseEnter={() => setHoveredCert(cert.id)}
                        onMouseLeave={() => setHoveredCert(null)}
                      >
                        <Image
                          src={cert.url}
                          alt="Sertifikat"
                          fill
                          style={{
                            objectFit: "cover",
                            filter:
                              hoveredCert === cert.id
                                ? "brightness(0.85)"
                                : "none",
                          }}
                        />
                        {hoveredCert === cert.id && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              background: "rgba(30,55,105,.75)",
                              fontWeight: 600,
                            }}
                          >
                            Lihat Sertifikat
                          </div>
                        )}
                      </div>

                      <Button
                        variant="light"
                        radius="xl"
                        onClick={() => {
                          setModalImg(cert.url);
                          setModalOpen(true);
                        }}
                      >
                        Lihat Sertifikat
                      </Button>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
            {certificates.length === 0 && (
              <Card
                withBorder
                radius="xl"
                p="xl"
                style={{ textAlign: "center", background: "#f8fafc" }}
              >
                <IconCertificate size={48} color="var(--primary-color)" />
                <Text c="dimmed" mt={10}>
                  Belum ada sertifikat yang diperoleh
                </Text>
              </Card>
            )}
          </Stack>
        )}
      </Card>

      {/* Modal Sertifikat */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pratinjau Sertifikat"
        size="xl"
        centered
      >
        {modalImg && (
          <div style={{ position: "relative", width: "100%", height: 420 }}>
            <Image
              src={modalImg}
              alt="Sertifikat"
              fill
              style={{ objectFit: "contain", borderRadius: 12 }}
            />
          </div>
        )}
      </Modal>
    </Container>
  );
}
