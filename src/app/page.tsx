"use client";

import { useAuth } from "../hooks/useAuth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Grid,
  Card,
  Badge,
  Box,
  Flex,
  Divider,
  SimpleGrid,
  Burger,
  Drawer,
  Anchor,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBook,
  IconTrophy,
  IconArrowRight,
  IconUsers,
  IconCertificate,
  IconStar,
  IconDeviceGamepad2,
  IconCheck,
  IconCode,
  IconLanguage,
  IconRobot,
  IconTarget,
  IconBook2,
  IconMicrophone2,
  IconBulb,
  IconSchool,
} from "@tabler/icons-react";
import PrimeLoader from "@/components/PrimeLoader";

// Navbar Component with scroll effect and section highlighting
function Navbar() {
  const router = useRouter();
  const [opened, { toggle }] = useDisclosure(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  const navLinks = [
    { label: "Beranda", href: "#hero" },
    { label: "Program", href: "#programs" },
    { label: "Mengapa Kami", href: "#why-choose" },
    { label: "Metode", href: "#learning-method" },
    { label: "Testimoni", href: "#testimonials" },
  ];

  // Handle scroll effect and active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const isScrolled = scrollY > 50;
      setScrolled(isScrolled);

      const sections = [
        "hero",
        "programs",
        "why-choose",
        "learning-method",
        "testimonials",
      ];
      // Only activate non-hero highlighting once user passes a small threshold below hero
      const thresholdOffset = 120; // px down from top triggers leaving hero
      let current = "hero";
      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 120) current = id; // near viewport top
      }
      // If still at hero near top and not scrolled enough, keep hero
      if (scrollY < thresholdOffset) current = "hero";
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const targetId = href.replace("#", "");
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Box
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background:
          scrolled || opened
            ? "var(--primary-color)"
            : "rgba(30, 55, 105, 0.1)",
        borderBottom:
          scrolled || opened ? "none" : "1px solid rgba(30, 55, 105, 0.2)",
        transition: "all 0.3s ease",
      }}
    >
      <Container size="xl">
        <Group justify="space-between" h={70}>
          {/* Logo */}
          <Flex align="center" gap="md">
            <Image
              src="/logo-text-side.png"
              alt="AfterSchola Logo"
              width={120}
              height={80}
            />
          </Flex>

          {/* Desktop Navigation */}
          <Group gap="sm" visibleFrom="md">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href.replace("#", "");
              const leavingHero = activeSection !== "hero"; // only show filled style after leaving hero
              return (
                <Button
                  key={link.label}
                  variant={isActive && leavingHero ? "filled" : "subtle"}
                  onClick={() => scrollToSection(link.href)}
                  size="sm"
                  styles={{
                    root: {
                      backgroundColor:
                        isActive && leavingHero
                          ? "var(--secondary-color)"
                          : "transparent",
                      color:
                        isActive && leavingHero
                          ? "var(--primary-color)"
                          : "var(--secondary-color)",
                      fontWeight: isActive ? 600 : 500,
                      transition: "background-color .25s, color .25s",
                    },
                  }}
                >
                  {link.label}
                </Button>
              );
            })}
          </Group>

          {/* Auth Buttons */}
          <Group gap="md" visibleFrom="md">
            <Button
              variant="outline"
              color={scrolled ? "white" : "white"}
              onClick={() => router.push("/login")}
            >
              Masuk
            </Button>
            <Button
              style={{
                background: "var(--secondary-color)",
                color: "var(--primary-color)",
              }}
              onClick={() => router.push("/signup")}
            >
              Daftar
            </Button>
          </Group>

          {/* Mobile Menu Button */}
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="md"
            size="sm"
            color={scrolled || opened ? "white" : "var(--primary-color)"}
          />
        </Group>
      </Container>

      {/* Mobile Drawer */}
      <Drawer
        opened={opened}
        onClose={toggle}
        position="right"
        size="xs"
        title="Menu"
      >
        <Stack gap="md" p="md">
          {navLinks.map((link) => (
            <Anchor
              key={link.label}
              onClick={() => {
                scrollToSection(link.href);
                toggle();
              }}
              c="var(--primary-color)"
              fw={500}
              style={{ textDecoration: "none", cursor: "pointer" }}
            >
              {link.label}
            </Anchor>
          ))}
          <Divider />
          <Button
            variant="outline"
            color="var(--primary-color)"
            onClick={() => {
              toggle();
              router.push("/login");
            }}
          >
            Masuk
          </Button>
          <Button
            style={{
              background: "var(--secondary-color)",
              color: "var(--primary-color)",
            }}
            onClick={() => {
              toggle();
              router.push("/signup");
            }}
          >
            Daftar
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}

// Hero Section
function HeroSection() {
  const router = useRouter();

  return (
    <Box
      id="hero"
      style={{
        backgroundImage: "url(/bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        position: "relative",
        paddingTop: 70, // Account for fixed navbar
      }}
    >
      {/* Overlay */}
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(30, 55, 105, 0.8)",
          zIndex: 1,
        }}
      />

      <Container size="xl" style={{ position: "relative", zIndex: 2 }}>
        <Grid align="center" justify="space-between">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="xl">
              <Box>
                <Title
                  size="3.5rem"
                  fw={700}
                  mb="md"
                  c="white"
                  style={{ lineHeight: 1.1 }}
                >
                  Selamat Datang di{"\n"}
                  <Text
                    fw={800}
                    fz={"3rem"}
                    component="span"
                    style={{
                      background: "var(--secondary-color)",
                      color: "var(--primary-color)",
                      padding: "0 12px",
                      borderRadius: "8px",
                    }}
                  >
                    AfterSchola
                  </Text>
                </Title>
                <Text size="lg" c="gray.2" mb="xl">
                  Mitra terpercaya yang membantu anak Indonesia mengembangkan
                  potensi terbaik mereka untuk mendukung Indonesia Emas 2045.
                </Text>
              </Box>

              <Group gap="md">
                <Button
                  size="lg"
                  style={{
                    background: "var(--secondary-color)",
                    color: "var(--primary-color)",
                    fontWeight: 600,
                  }}
                  rightSection={<IconArrowRight size="1.2rem" />}
                  onClick={() => router.push("/signup")}
                >
                  Mulai Sekarang
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  color="white"
                  onClick={() => {
                    const element = document.getElementById("programs");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  Lihat Program
                </Button>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box ta="left">
              <Image
                src="/abacus.png"
                alt="AfterSchola"
                width={300}
                height={300}
                style={{
                  filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))",
                  opacity: 0.9,
                }}
              />
            </Box>
          </Grid.Col>
        </Grid>

        {/* Stats Section - sejajar dengan buttons */}
        <Box mt={60}>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
            <Card
              padding="md"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                textAlign: "center",
              }}
            >
              <Title order={2} c="var(--secondary-color)" mb="xs">
                1,000+
              </Title>
              <Text c="white" size="sm" fw={500}>
                Siswa Aktif Terdaftar
              </Text>
            </Card>

            <Card
              padding="md"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                textAlign: "center",
              }}
            >
              <Title order={2} c="var(--secondary-color)" mb="xs">
                20+
              </Title>
              <Text c="white" size="sm" fw={500}>
                Mitra Sekolah
              </Text>
            </Card>

            <Card
              padding="md"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                textAlign: "center",
              }}
            >
              <Title order={2} c="var(--secondary-color)" mb="xs">
                5+
              </Title>
              <Text c="white" size="sm" fw={500}>
                Lokasi
              </Text>
            </Card>
          </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
}

// Programs Section with Real AfterSchola Programs
function ProgramsSection() {
  const programs = [
    {
      icon: IconCode,
      title: "Coding",
      description:
        "Belajar dasar-dasar pemrograman hingga menciptakan aplikasi dan game interaktif.",
      color: "blue",
    },
    {
      icon: IconLanguage,
      title: "Bahasa Inggris",
      description:
        "Mengasah kemampuan berbahasa Inggris melalui metode belajar yang menyenangkan.",
      color: "green",
    },
    {
      icon: IconRobot,
      title: "Robotik",
      description:
        "Mengeksplorasi teknologi robotika untuk mempersiapkan siswa dalam era digital.",
      color: "orange",
    },
    {
      icon: IconTarget,
      title: "Panahan",
      description:
        "Melatih konsentrasi dan disiplin melalui olahraga tradisional yang menantang.",
      color: "red",
    },
    {
      icon: IconBook2,
      title: "Tahfiz",
      description:
        "Membantu siswa mendalami dan menghafal Al-Quran dengan metode yang efektif.",
      color: "teal",
    },
    {
      icon: IconMicrophone2,
      title: "Public Speaking & Podcast",
      description:
        "Mengasah kemampuan berbicara di depan umum dan menyampaikan ide kreatif melalui media digital.",
      color: "purple",
    },
    {
      icon: IconBulb,
      title: "Creativor",
      description:
        "Mengembangkan kreativitas dan inovasi siswa melalui berbagai proyek menarik.",
      color: "yellow",
    },
  ];

  return (
    <Container id="programs" size="xl" py={80}>
      <Stack align="center" gap="xl">
        <Box ta="center" maw={700}>
          <Text size="lg" c="var(--secondary-color)" fw={600} mb="sm">
            Program Kursus AfterSchola
          </Text>
          <Title order={2} size="2.5rem" mb="md" c="var(--primary-color)">
            Program Beragam dan Berkualitas
          </Title>
          <Text size="lg" c="dimmed">
            AfterSchola menawarkan berbagai kursus yang dirancang untuk
            mengembangkan keterampilan siswa di berbagai bidang
          </Text>
        </Box>

        <Grid gutter="xl" mt="xl">
          {programs.map((program, index) => (
            <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
              <Card
                padding="xl"
                radius="lg"
                className="card-hover"
                h="100%"
                style={{
                  border: "1px solid var(--border-color)",
                  background: "white",
                }}
              >
                <Stack gap="md">
                  <Box
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "12px",
                      background: "var(--secondary-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <program.icon size="1.8rem" color="var(--primary-color)" />
                  </Box>
                  <Title order={4} fw={600} c="var(--primary-color)">
                    {program.title}
                  </Title>
                  <Text c="dimmed" size="sm">
                    {program.description}
                  </Text>
                  <Badge variant="light" color={program.color} size="sm">
                    Program Unggulan
                  </Badge>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}

// Why Choose AfterSchola Section
function WhyChooseSection() {
  const reasons = [
    {
      title: "Program Beragam dan Berkualitas",
      description:
        "Berbagai kursus yang dirancang untuk mengembangkan keterampilan siswa di berbagai bidang",
      icon: IconBook,
    },
    {
      title: "Dukungan untuk Program Indonesia Emas 2045",
      description:
        "Mempersiapkan generasi muda Indonesia untuk masa depan yang lebih cerah",
      icon: IconTrophy,
    },
    {
      title: "Pengajar Profesional dan Berpengalaman",
      description:
        "Tim pengajar yang berkualitas dan berpengalaman di bidangnya",
      icon: IconUsers,
    },
    {
      title: "Metode Pembelajaran Inovatif",
      description: "Pendekatan pembelajaran yang modern dan mudah dipahami",
      icon: IconBulb,
    },
  ];

  return (
    <Box id="why-choose" style={{ background: "var(--accent-color)" }} py={80}>
      <Container size="xl">
        <Stack align="center" gap="xl">
          <Box ta="center" maw={600}>
            <Text size="lg" c="var(--secondary-color)" fw={600} mb="sm">
              Alasan Tepat untuk Pendidikan Berkualitas
            </Text>
            <Title order={2} size="2.5rem" mb="md" c="var(--primary-color)">
              Mengapa Memilih AfterSchola?
            </Title>
          </Box>

          <Grid gutter="xl" mt="xl">
            {reasons.map((reason, index) => (
              <Grid.Col key={index} span={{ base: 12, md: 6 }}>
                <Card
                  padding="xl"
                  radius="lg"
                  bg="white"
                  h="100%"
                  style={{ border: "1px solid var(--border-color)" }}
                >
                  <Flex gap="md" align="flex-start">
                    <Box
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: "50%",
                        background: "var(--secondary-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <reason.icon size="1.5rem" color="var(--primary-color)" />
                    </Box>
                    <Stack gap="sm">
                      <Title order={4} fw={600} c="var(--primary-color)">
                        {reason.title}
                      </Title>
                      <Text c="dimmed" size="sm">
                        {reason.description}
                      </Text>
                    </Stack>
                  </Flex>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

// Learning Method Section
function LearningMethodSection() {
  return (
    <Container size="xl" py={80} id="learning-method">
      <Stack align="center" gap="xl">
        <Box ta="center" maw={600}>
          <Text size="lg" c="var(--secondary-color)" fw={600} mb="sm">
            Tempat
          </Text>
          <Title order={2} size="2.5rem" mb="md" c="var(--primary-color)">
            Dimana Pembelajaran Dilakukan
          </Title>
          <Text size="lg" c="dimmed">
            AfterSchola menyediakan kelas online dan offline untuk menjangkau
            lebih banyak siswa di berbagai lokasi. Dengan pendekatan fleksibel
            ini, kami memastikan setiap siswa dapat belajar sesuai kebutuhan
            mereka.
          </Text>
        </Box>

        <Grid gutter="xl" mt="xl">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card
              padding="xl"
              radius="lg"
              className="card-hover"
              h="100%"
              style={{
                border: "2px solid var(--secondary-color)",
                background: "white",
              }}
            >
              <Stack align="center" gap="lg" ta="center">
                <Box
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "var(--secondary-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconSchool size="2.5rem" color="var(--primary-color)" />
                </Box>
                <Title order={3} c="var(--primary-color)">
                  Offline Kelas
                </Title>
                <Text c="dimmed">
                  Belajar langsung di lokasi kami dengan fasilitas lengkap dan
                  bimbingan tatap muka dari pengajar berpengalaman.
                </Text>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card
              padding="xl"
              radius="lg"
              className="card-hover"
              h="100%"
              style={{
                border: "2px solid var(--primary-color)",
                background: "white",
              }}
            >
              <Stack align="center" gap="lg" ta="center">
                <Box
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "var(--primary-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconDeviceGamepad2 size="2.5rem" color="white" />
                </Box>
                <Title order={3} c="var(--primary-color)">
                  Online Kelas
                </Title>
                <Text c="dimmed">
                  Mengikuti pembelajaran jarak jauh melalui platform digital
                  dengan akses mudah dari rumah.
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}

// Stats Section
function StatsSection() {
  const stats = [
    { value: "1000+", label: "Siswa Aktif", icon: IconUsers },
    { value: "50+", label: "Kursus Tersedia", icon: IconBook },
    { value: "800+", label: "Sertifikat Diterbitkan", icon: IconCertificate },
    { value: "4.8/5", label: "Rating Kepuasan", icon: IconStar },
  ];

  return (
    <Container size="xl" py={80}>
      <Box ta="center" mb="xl">
        <Title order={2} size="2.5rem" mb="md" className="text-gradient">
          Pencapaian Kami
        </Title>
        <Text size="lg" c="dimmed">
          Angka-angka yang menunjukkan kepercayaan dan kepuasan pengguna
        </Text>
      </Box>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xl">
        {stats.map((stat, index) => (
          <Card
            key={index}
            padding="xl"
            radius="lg"
            ta="center"
            className="card-hover"
            style={{ border: "1px solid var(--border-color)" }}
          >
            <Stack align="center" gap="md">
              <Box
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "var(--gradient-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <stat.icon size="1.8rem" color="white" />
              </Box>
              <Title order={2} fw={700} c="var(--primary-color)">
                {stat.value}
              </Title>
              <Text c="dimmed" fw={500}>
                {stat.label}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}

// Testimonials Section
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sari Indah",
      role: "Orang Tua",
      content:
        "Anak saya sangat antusias belajar coding melalui AfterSchola. Pembelajaran yang interaktif membuat dia lebih tertarik dengan teknologi.",
      rating: 5,
    },
    {
      name: "Budi Santoso",
      role: "Guru SD",
      content:
        "Sebagai pendidik, saya melihat dampak positif AfterSchola pada siswa. Mereka menjadi lebih kreatif dalam memecahkan masalah.",
      rating: 5,
    },
    {
      name: "Maya Putri",
      role: "Instruktur AfterSchola",
      content:
        "Platform yang mudah digunakan dan materi yang terstruktur dengan baik membantu saya mengajar dengan lebih efektif.",
      rating: 5,
    },
  ];

  return (
    <Container size="xl" py={80} id="testimonials">
      <Stack align="center" gap="xl">
        <Box ta="center" maw={600}>
          <Text size="lg" c="var(--secondary-color)" fw={600} mb="sm">
            Testimoni
          </Text>
          <Title order={2} size="2.5rem" mb="md" c="var(--primary-color)">
            Apa Kata Mereka?
          </Title>
          <Text size="lg" c="dimmed">
            Dengar langsung pengalaman orang tua, pendidik, dan siswa yang telah
            merasakan manfaat program AfterSchola.
          </Text>
        </Box>

        <Grid gutter="xl" mt="xl">
          {testimonials.map((testimonial, index) => (
            <Grid.Col key={index} span={{ base: 12, md: 4 }}>
              <Card
                padding="xl"
                radius="lg"
                className="card-hover"
                h="100%"
                style={{
                  border: "1px solid var(--border-color)",
                  background: "white",
                }}
              >
                <Stack gap="md">
                  <Flex gap={2}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <IconStar
                        key={i}
                        size="1rem"
                        fill={
                          i < testimonial.rating
                            ? "var(--secondary-color)"
                            : "transparent"
                        }
                        color="var(--secondary-color)"
                      />
                    ))}
                  </Flex>

                  <Text size="md" style={{ lineHeight: 1.6 }} c="dark">
                    &ldquo;{testimonial.content}&rdquo;
                  </Text>

                  <Box mt="md">
                    <Text fw={600} c="var(--primary-color)">
                      {testimonial.name}
                    </Text>
                    <Text size="sm" c="var(--secondary-color)">
                      {testimonial.role}
                    </Text>
                  </Box>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}

// CTA Section
function CTASection() {
  const router = useRouter();

  return (
    <Box
      py={80}
      style={{
        background: "var(--gradient-primary)",
        color: "white",
      }}
    >
      <Container size="xl">
        <Stack align="center" ta="center" gap="xl">
          <Box maw={800}>
            <Title size="2.5rem" mb="md">
              Bergabunglah dengan AfterSchola
            </Title>
            <Text size="lg" c="gray.2" mb="xl">
              Mulai perjalanan belajar anak Indonesia menuju masa depan yang
              lebih cerah. Daftar sekarang dan akses berbagai program
              berkualitas dari AfterSchola!
            </Text>
          </Box>

          <Group gap="md" justify="center">
            <Button
              size="xl"
              style={{
                background: "var(--secondary-color)",
                color: "var(--primary-color)",
                fontWeight: 600,
              }}
              rightSection={<IconArrowRight size="1.2rem" />}
              onClick={() => router.push("/signup")}
            >
              Daftar Sekarang
            </Button>
            <Button
              size="xl"
              variant="outline"
              color="white"
              onClick={() => router.push("/login")}
            >
              Masuk
            </Button>
          </Group>

          <Group gap="md" mt="xl">
            <Flex align="center" gap="xs">
              <IconCheck size="1rem" color="var(--secondary-color)" />
              <Text size="sm" c="gray.3">
                Program Berkualitas
              </Text>
            </Flex>
            <Flex align="center" gap="xs">
              <IconCheck size="1rem" color="var(--secondary-color)" />
              <Text size="sm" c="gray.3">
                Pendidik Berpengalaman
              </Text>
            </Flex>
            <Flex align="center" gap="xs">
              <IconCheck size="1rem" color="var(--secondary-color)" />
              <Text size="sm" c="gray.3">
                Sertifikat Resmi
              </Text>
            </Flex>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}

// Footer Section
function FooterSection() {
  const year = new Date().getFullYear();

  return (
    <Box style={{ background: "var(--primary-color)" }} py={60}>
      <Container size="xl">
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <Flex align="center" gap="md">
                <Image
                  src="/logo.png"
                  alt="AfterSchola Logo"
                  width={50}
                  height={50}
                />
                <Title order={3} c="var(--secondary-color)">
                  AfterSchola
                </Title>
              </Flex>
              <Text c="gray.4" size="sm" style={{ lineHeight: 1.6 }}>
                Membangun masa depan Indonesia yang lebih cerah melalui
                pendidikan berkualitas untuk generasi muda. Bersama menuju
                Indonesia Emas 2045.
              </Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 2 }}>
            <Stack gap="md">
              <Title order={5} c="white">
                Program
              </Title>
              <Stack gap="xs">
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Public Speaking
                </Text>
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Coding for Kids
                </Text>
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  English Club
                </Text>
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Robotik
                </Text>
              </Stack>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 2 }}>
            <Stack gap="md">
              <Title order={5} c="white">
                Perusahaan
              </Title>
              <Stack gap="xs">
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Tentang Kami
                </Text>
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Karir
                </Text>
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Blog
                </Text>
                <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
                  Kontak
                </Text>
              </Stack>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <Title order={5} c="white">
                Hubungi Kami
              </Title>
              <Stack gap="sm">
                <Anchor
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=admin@afterschola.com"
                  target="_blank"
                  c="gray.4"
                  size="sm"
                  style={{ textDecoration: "none" }}
                >
                  📧 hello@afterschola.com
                </Anchor>
                <Anchor
                  href="http://wa.me/+6282338089915"
                  c="gray.4"
                  size="sm"
                  style={{ textDecoration: "none" }}
                >
                  📞 +62 823-3808-9915
                </Anchor>
                <Anchor
                  href="https://maps.app.goo.gl/UzPNsQa1rV5Ba95q9"
                  target="_blank"
                  rel="noopener noreferrer"
                  c="gray.4"
                  size="sm"
                  style={{ textDecoration: "none" }}
                >
                  📍 Jl. Cisaranten Wetan No.167 A, Cisaranten Wetan, Kec.
                  Cinambo, Kota Bandung, Jawa Barat 40294
                </Anchor>
              </Stack>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider color="gray.7" my="xl" />

        <Flex
          justify="space-between"
          align="center"
          direction={{ base: "column", sm: "row" }}
          gap="md"
        >
          <Text c="gray.5" size="sm" ta="center">
            © {year} AfterSchola. Mendukung Program Indonesia Emas 2045.
          </Text>
          <Group gap="md">
            <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
              Kebijakan Privasi
            </Text>
            <Text c="gray.4" size="sm" style={{ cursor: "pointer" }}>
              Syarat & Ketentuan
            </Text>
          </Group>
        </Flex>
      </Container>
    </Box>
  );
}

function LandingPage() {
  return (
    <Stack gap={0}>
      <Navbar />
      <HeroSection />
      <ProgramsSection />
      <WhyChooseSection />
      <LearningMethodSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
      <FooterSection />
    </Stack>
  );
}

function AppContent() {
  const { loading } = useAuth();

  if (loading) {
    return <PrimeLoader />;
  }

  return <LandingPage />;
}

export default function HomePage() {
  return <AppContent />;
}
