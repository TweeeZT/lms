"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
  Textarea,
} from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
// no local dummy courses; data comes from APIs
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCertificate,
  IconArrowLeft,
  IconCalendar,
  IconAward,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconCrown,
  IconTrophy,
  IconLock,
  IconPrinter,
} from "@tabler/icons-react";
import NextImage from "next/image";
import Cropper from "react-easy-crop";
import CertificateThumbnail from "../../../components/CertificateThumbnail";
import { notifications } from "@mantine/notifications";

export default function UserProfilePage() {
  const { user, updateUser } = useAuth();
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
  // level color map not used currently

  // form states (initialized after fetch)
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");

  // server data
  // numeric level no longer used; tier derived from xp/points/courses
  const [points, setPoints] = useState<number>(user?.points ?? 0);
  // const [balance, setBalance] = useState<number>(user?.balance ?? 0);
  const [currentXP, setCurrentXP] = useState<number>(0);
  const [, setNextLevelXP] = useState<number>(1500);
  const [coursesCompleted, setCoursesCompleted] = useState<number>(0);
  const avgScore = useMemo(
    () =>
      Math.floor(
        (Number(currentXP || 0) +
          Number(points || 0) +
          Number(coursesCompleted || 0)) /
          3
      ),
    [currentXP, points, coursesCompleted]
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // purchases and certificates from API
  const [latestPaid, setLatestPaid] = useState<
    {
      id: string;
      date: string;
      courseTitle: string;
      amount: number;
      status: string;
    }[]
  >([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const txLimit = 10;
  const [certificates, setCertificates] = useState<
    { id: string; courseTitle: string; date: string; url: string | null }[]
  >([]);

  // keep initial snapshot for reset
  const initialRef = useRef<{
    fullName: string;
    username: string;
    email: string;
    phone: string;
    bio: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState<string | null>(null);
  // const levelsViewportRef = useRef<HTMLDivElement | null>(null);

  // avatar crop states
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // derive tier label from thresholds (same as TierCarouselCard)
  const getTier = useCallback((xp: number, pts: number, courses: number) => {
    const tiers = [
      { key: "master", xp: 60000, points: 120000, courses: 50 },
      { key: "hero", xp: 50000, points: 100000, courses: 40 },
      { key: "futuristic", xp: 40000, points: 80000, courses: 32 },
      { key: "creative", xp: 30000, points: 60000, courses: 20 },
      { key: "scientist", xp: 20000, points: 40000, courses: 12 },
      { key: "explorer", xp: 10000, points: 20000, courses: 8 },
      { key: "newbie", xp: 0, points: 0, courses: 0 },
    ] as const;
    for (const t of tiers) {
      if (xp >= t.xp && pts >= t.points && courses >= t.courses) return t.key;
    }
    return "newbie" as const;
  }, []);

  const onSelectAvatar = () => fileInputRef.current?.click();
  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatarSrc(url);
    setAvatarEditorOpen(true);
  };
  const onCropComplete = (
    _: unknown,
    areaPixels: { width: number; height: number; x: number; y: number }
  ) => {
    setCroppedAreaPixels(areaPixels);
  };

  async function getCroppedBlob(
    imageSrc: string,
    cropPixels: { x: number; y: number; width: number; height: number }
  ): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = document.createElement("img");
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(e);
      i.src = imageSrc;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cropPixels.width));
    canvas.height = Math.max(1, Math.round(cropPixels.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas ctx missing");
    ctx.drawImage(
      img,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92)
    );
  }

  // Thermal Receipt Print for purchases
  const RECEIPT_INFO = {
    addressLines: [
      "AfterSchola Learning Platform",
      "Jl. Pendidikan No. 123",
      "Jakarta Selatan, Indonesia",
      "Telp: (021) 123-4567",
    ],
    footer: [
      "Terima kasih atas kepercayaan Anda",
      "www.afterschola.com",
      "support@afterschola.com",
    ],
  };

  const displayMethod = (method?: string) => {
    if (!method) return "Transfer Bank";
    const m = method.toLowerCase();
    if (m.includes("qris")) return "QRIS";
    if (m.includes("bca")) return "BCA Virtual Account";
    if (m.includes("mandiri")) return "Mandiri Virtual Account";
    if (m.includes("bni")) return "BNI Virtual Account";
    if (m.includes("bri")) return "BRI Virtual Account";
    if (m.includes("gopay")) return "GoPay";
    if (m.includes("ovo")) return "OVO";
    if (m.includes("dana")) return "DANA";
    return method;
  };

  const statusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "paid") return "Berhasil";
    if (s === "pending") return "Menunggu";
    if (s === "cancelled" || s === "failed") return "Gagal";
    return status;
  };

  const printThermalReceipt = (t: {
    id: string;
    date: string;
    courseTitle: string;
    amount: number;
    status: string;
  }) => {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) {
      notifications.show({
        title: "Gagal",
        message: "Popup diblokir oleh browser",
        color: "red",
      });
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const line = (text = "") => `<div class="ln">${text}</div>`;
    const hr = `<pre style="margin:0;text-align:center;">------------------------------------------</pre>`;
    const pad = (label: string, value: string) => {
      const max = 40;
      const raw = `${label}${value}`;
      return raw.length > max ? raw.slice(0, max) : raw;
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Pembayaran</title>
      <style>
        @page {
          size: A5;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          width: 80mm;
          margin: 0 auto;
          padding: 10mm;
          color: #000;
        }
        .logo { text-align: center; margin-bottom: 8px; }
        .logo img { width: 90px; height: auto; }
        h1 { font-size: 16px; text-align: center; margin: 6px 0; }
        .addr, .ftr { text-align: center; white-space: pre-line; margin-bottom: 6px; }
        .sep {
          text-align: center;
          font-size: 12px;
          margin: 0;
          line-height: 1;
        }
        .ln { display: block; }
        .center { text-align: center; }
        @media print {
          header, footer { display: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="logo"><img src="/logo-text.png" alt="Logo" /></div>
      <h1>STRUK PEMBAYARAN</h1>
      <div class="addr">${RECEIPT_INFO.addressLines.join("<br>")}</div>
      ${hr}
      ${line(pad("ID Transaksi: ", t.id))}
      ${line(pad("Tanggal: ", dateStr))}
      ${line(pad("Waktu: ", timeStr))}
      ${line(pad("Nama: ", user?.fullName || "User"))}
      ${line(pad("Kursus: ", t.courseTitle))}
      ${line(pad("Metode: ", displayMethod()))}
      ${line(pad("Status: ", statusLabel(t.status)))}
      ${hr}
      ${line(pad("Total Bayar: ", formatCurrency(t.amount)))}
      ${hr}
      <div class="ftr">${RECEIPT_INFO.footer.join("<br>")}</div>
      <div class="center" style="margin-top:16px;font-size:10px;">Dicetak: ${dateStr} ${timeStr}</div>
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
    `;

    w.document.write(html);
    w.document.close();
  };

  // fetch profile + related lists
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        // profile
        const res = await fetch(`/api/user/profile?userId=${user.id}`);
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat profil");
        const u = json.user as {
          id: string;
          email: string;
          username: string;
          fullName: string;
          avatar?: string;
          phone?: string;
          bio?: string;
          role: string;
          level: number;
          points: number;
          balance: number;
          createdAt: string;
          updatedAt: string;
        };
        setFullName(u.fullName || "");
        setUsername(u.username || "");
        setEmail(u.email || "");
        setPhone(u.phone || "");
        setBio(u.bio || "");
        // numeric level is deprecated in UI
        setPoints(Number(u.points || 0));
        // setBalance(Number(u.balance || 0)); // not displayed currently
        setCurrentXP(Number(json.summary?.currentXP || 0));
        setNextLevelXP(Number(json.summary?.nextLevelXP || 1500));
        setCoursesCompleted(Number(json.summary?.coursesCompleted || 0));
        initialRef.current = {
          fullName: u.fullName || "",
          username: u.username || "",
          email: u.email || "",
          phone: u.phone || "",
          bio: u.bio || "",
        };

        // transactions (latest, prefer completed/paid)
        const tr = await fetch(
          `/api/user/transactions?userId=${user.id}&page=${txPage}&limit=${txLimit}&sortBy=date&sortDir=desc`
        );
        const tj = await tr.json();
        if (tr.ok && tj.success) {
          type ApiTx = {
            id: string;
            date: string;
            course_title: string;
            amount: number;
            status: string;
          };
          const items = (tj.items as ApiTx[]).filter(
            (r) =>
              String(r.status).toLowerCase() === "completed" ||
              String(r.status).toLowerCase() === "paid"
          );
          setLatestPaid(
            items.map((r) => ({
              id: r.id,
              date: r.date,
              courseTitle: r.course_title,
              amount: Number(r.amount || 0),
              status: r.status,
            }))
          );
          setTxTotal(Number(tj.total || items.length));
        } else {
          setLatestPaid([]);
          setTxTotal(0);
        }

        // certificates
        const cr = await fetch(
          `/api/user/certificates?userId=${user.id}&page=1&limit=10&sortBy=date&sortDir=desc`
        );
        const cj = await cr.json();
        if (cr.ok && cj.success) {
          type ApiCert = {
            id: string;
            course_title: string;
            issued_date?: string; // actual field from API
            created_at?: string;
            updated_at?: string;
            certificate_url: string | null;
          };
          setCertificates(
            (cj.items as ApiCert[]).map((c) => {
              const rawDate =
                c.issued_date || c.created_at || c.updated_at || "";
              return {
                id: c.id,
                courseTitle: c.course_title,
                date: rawDate,
                url: c.certificate_url || "/certificate_template.png",
              };
            })
          );
        } else {
          setCertificates([]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memuat profil");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, txPage]);

  if (!user) return null;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  const formatDate = (dateString: string) => {
    if (!dateString) return "Tanggal tidak tersedia";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Tanggal tidak valid";
      }
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Tanggal tidak valid";
    }
  };

  // Achievement hero requirement targets
  // thresholds handled in TierCarouselCard

  // Simple level roadmap omitted
  // const currentLevelIndex = Math.max(0, Math.min(levelRoadmap.length - 1, (level || 1) - 1));
  // const scrollLevels = (dir: -1 | 1) => {
  //   const vp = levelsViewportRef.current;
  //   if (!vp) return;
  //   const delta = dir * Math.min(320, vp.clientWidth - 24);
  //   vp.scrollTo({ left: vp.scrollLeft + delta, behavior: "smooth" });
  // };

  // derived flags removed; TierCarouselCard uses raw stats

  const onReset = () => {
    const init = initialRef.current;
    if (!init) return;
    setFullName(init.fullName);
    setUsername(init.username);
    setEmail(init.email);
    setPhone(init.phone);
    setBio(init.bio);
  };

  const onSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/profile/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          fullName,
          username,
          phone,
          bio,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menyimpan");
      // reflect in auth context
      updateUser({ fullName, username, phone, bio } as any);
      // update initial snapshot
      initialRef.current = { fullName, username, email, phone, bio } as any;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

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
        withBorder
        style={{
          background: "var(--primary-color)",
        }}
      >
        {error && !loading && <Text c="red">{error}</Text>}
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
            <Title order={2} c="white" mb={6}>
              {fullName || user.fullName}
            </Title>
            <Group gap="md" mb="sm">
              <Badge
                bg="var(--secondary-color)"
                variant="filled"
                radius="xl"
                c="var(--primary-color)"
              >
                Tier{" "}
                {getTier(currentXP, points, coursesCompleted).toUpperCase()}
              </Badge>
              <Badge color="var(--secondary-color)" variant="light" radius="xl">
                Skor {avgScore}
              </Badge>
            </Group>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarFile}
            />
            <Button
              bg="var(--secondary-color)"
              variant="filled"
              radius="xl"
              c="var(--primary-color)"
              onClick={onSelectAvatar}
            >
              Ganti Avatar
            </Button>
          </div>
        </Group>
      </Card>

      {/* Content */}
      <Card
        radius="xl"
        p="xl"
        withBorder
        style={{
          background: "var(--card-bg)",
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
              {/* Username Scratch removed: use main username as Scratch username */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Email"
                  leftSection={<IconMail size={16} />}
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  disabled
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
              <Button
                variant="light"
                radius="xl"
                onClick={onReset}
                disabled={saving}
              >
                Reset
              </Button>
              <Button
                bg="var(--primary-color)"
                variant="filled"
                radius="xl"
                c="white"
                loading={saving}
                onClick={onSave}
              >
                Simpan Perubahan
              </Button>
            </Group>
          </Stack>
        )}

        {/* Achievements */}
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
            </Group>

            <TierCarouselCard
              stats={{ xp: currentXP, points, coursesCompleted }}
            />

            {/* Leaderboard Top 5 */}
            <Leaderboard />
          </Stack>
        )}

        {activeTab === "purchases" && (
          <Stack gap="lg">
            <Title order={3} c="var(--primary-color)">
              Riwayat Pembelian
            </Title>
            <Group justify="space-between" align="center">
              <Text size="sm" c="white">
                Halaman {txPage} dari{" "}
                {Math.max(1, Math.ceil(txTotal / txLimit))}
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  disabled={txPage >= Math.max(1, Math.ceil(txTotal / txLimit))}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </Group>
            </Group>
            {latestPaid.map((t) => (
              <Card
                key={t.id}
                withBorder
                radius="md"
                p="lg"
                className="card-hover"
              >
                <Group justify="space-between" align="start">
                  <div style={{ flex: 1 }}>
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
                  <Stack gap="xs" align="flex-end">
                    <Text fw={700} size="lg" c="green">
                      {formatCurrency(t.amount)}
                    </Text>
                    <Badge color="green" variant="light" radius="xl">
                      {String(t.status).toLowerCase() === "completed"
                        ? "Berhasil"
                        : t.status}
                    </Badge>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={<IconPrinter size={14} />}
                      onClick={() => printThermalReceipt(t)}
                    >
                      Print Struk
                    </Button>
                  </Stack>
                </Group>
              </Card>
            ))}
            {latestPaid.length === 0 && (
              <Text c="white" ta="center" py="xl">
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
                              {formatDate(cert.date)}
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
                          border: "2px solid var(--border-color)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--accent-color)",
                        }}
                        onClick={() => {
                          setModalImg(cert.url);
                          setModalOpen(true);
                        }}
                        onMouseEnter={() => setHoveredCert(cert.id)}
                        onMouseLeave={() => setHoveredCert(null)}
                      >
                        {cert.url && cert.url.endsWith(".pdf") ? (
                          <CertificateThumbnail
                            url={cert.url}
                            className="pdf-thumb"
                          />
                        ) : (
                          <NextImage
                            src={cert.url || "/certificate_template.png"}
                            alt="Sertifikat"
                            fill
                            style={{
                              objectFit: "cover",
                              filter:
                                hoveredCert === cert.id
                                  ? "brightness(0.85)"
                                  : "none",
                              transition: "filter 0.3s ease",
                            }}
                          />
                        )}

                        {/* Hover overlay sama kayak sebelumnya */}
                        {hoveredCert === cert.id && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              background: "rgba(30,55,105,0.9)",
                              fontWeight: 600,
                              backdropFilter: "blur(4px)",
                              zIndex: 2,
                            }}
                          >
                            <IconEye size={32} style={{ marginBottom: 8 }} />
                            <Text size="md" fw={600}>
                              Lihat Sertifikat
                            </Text>
                            <Text size="xs" opacity={0.8} mt={4}>
                              Klik untuk membuka di modal
                            </Text>
                          </div>
                        )}
                      </div>

                      <Group gap="xs">
                        <Button
                          variant="light"
                          radius="xl"
                          onClick={() => {
                            setModalImg(cert.url);
                            setModalOpen(true);
                          }}
                          flex={1}
                        >
                          Lihat Sertifikat
                        </Button>
                        {cert.url && (
                          <Button
                            variant="filled"
                            bg="var(--primary-color)"
                            radius="xl"
                            onClick={async () => {
                              if (!cert.url) return;
                              try {
                                const res = await fetch(cert.url, {
                                  cache: "no-store",
                                });
                                if (!res.ok)
                                  throw new Error("Gagal mengunduh sertifikat");
                                const blob = await res.blob();
                                const objectUrl = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                const ext =
                                  blob.type === "application/pdf"
                                    ? "pdf"
                                    : blob.type.split("/")[1] || "pdf";
                                link.href = objectUrl;
                                link.download = `sertifikat-${cert.courseTitle
                                  .replace(/\s+/g, "-")
                                  .toLowerCase()}.${ext}`;
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                URL.revokeObjectURL(objectUrl);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            flex={1}
                          >
                            Download
                          </Button>
                        )}
                      </Group>
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
          <Stack gap="md">
            <div style={{ position: "relative", width: "100%", height: 420 }}>
              {modalImg.endsWith(".pdf") ? (
                <iframe
                  src={modalImg}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    borderRadius: 12,
                  }}
                  title="Sertifikat PDF"
                />
              ) : (
                <NextImage
                  src={modalImg}
                  alt="Sertifikat"
                  fill
                  style={{ objectFit: "contain", borderRadius: 12 }}
                />
              )}
            </div>
          </Stack>
        )}
      </Modal>

      {/* Avatar Editor Modal */}
      <Modal
        opened={avatarEditorOpen}
        onClose={() => {
          setAvatarEditorOpen(false);
          if (avatarSrc) URL.revokeObjectURL(avatarSrc);
          setAvatarSrc(null);
          setZoom(1);
          setCrop({ x: 0, y: 0 });
          setCroppedAreaPixels(null);
        }}
        title="Atur Avatar"
        size="lg"
        centered
      >
        {avatarSrc && (
          <div
            style={{
              position: "relative",
              height: 320,
              background: "#111",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <Cropper
              image={avatarSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
            />
          </div>
        )}
        <Group mt="md" justify="space-between" align="center">
          <Text size="sm" c="white">
            Zoom
          </Text>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </Group>
        <Group justify="end" mt="lg">
          <Button variant="light" onClick={() => setAvatarEditorOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={async () => {
              try {
                if (!avatarSrc || !croppedAreaPixels || !user?.id) return;
                const blob = await getCroppedBlob(avatarSrc, croppedAreaPixels);
                const fd = new FormData();
                fd.append("file", blob, "avatar.jpg");
                fd.append("userId", user.id);
                fd.append("bucket", "avatar");
                fd.append("filename", "avatar.jpg");
                const up = await fetch("/api/storage/upload", {
                  method: "POST",
                  body: fd,
                });
                const uj = await up.json();
                if (!up.ok || !uj.success) {
                  notifications.show({
                    title: "Gagal Upload",
                    message: (uj && uj.error) || "Gagal mengunggah avatar",
                    color: "red",
                  });
                  return;
                }
                // cache-bust so UI shows the latest image immediately
                const rawUrl = uj.url as string;
                const avatarUrl = `${rawUrl}${
                  rawUrl.includes("?") ? "&" : "?"
                }t=${Date.now()}`;
                const avatarPath = uj.path as string;
                // save to user
                const save = await fetch("/api/user/profile/edit", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    avatarUrl,
                    avatarPath,
                  }),
                });
                const sj = await save.json();
                if (!save.ok || !sj.success) {
                  notifications.show({
                    title: "Gagal Menyimpan",
                    message: (sj && sj.error) || "Avatar tidak dapat disimpan",
                    color: "red",
                  });
                  return;
                }
                updateUser({ avatar: avatarUrl });
                notifications.show({
                  title: "Berhasil",
                  message: "Avatar berhasil diperbarui",
                  color: "green",
                });
                setAvatarEditorOpen(false);
                if (avatarSrc) URL.revokeObjectURL(avatarSrc);
                setAvatarSrc(null);
              } catch (e: unknown) {
                notifications.show({
                  title: "Terjadi Kesalahan",
                  message:
                    e instanceof Error ? e.message : "Gagal menyimpan avatar",
                  color: "red",
                });
              }
            }}
          >
            Simpan Avatar
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}

// Leaderboard component
function Leaderboard() {
  const [items, setItems] = useState<
    {
      rank: number;
      userId: string;
      fullName: string;
      username: string;
      avatar: string | null;
      level: number; // kept but not shown
      points: number;
      xp: number;
      coursesCompleted: number;
      score: number;
      tier: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/user/leaderboard?limit=${showAll ? 20 : 5}&page=1`
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat leaderboard");
        setItems(json.items || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memuat leaderboard");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [showAll]);

  if (loading) return <Text c="white">Memuat leaderboard…</Text>;
  if (error) return <Text c="red">{error}</Text>;

  // Podium style for top 3
  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <Card
      withBorder
      radius="xl"
      p="lg"
      style={{
        background: "var(--card-bg)",
        position: "relative",
      }}
    >
      <Group justify="space-between" mb="xs">
        <Title order={4} c="var(--primary-color)">
          Leaderboard Siswa
        </Title>
        <Button size="xs" variant="light" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Tampilkan Top 5" : "Lihat Semua"}
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Urutan berdasarkan rata-rata tiga kategori
      </Text>

      {/* Podium */}
      {top3.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            alignItems: "end",
            marginBottom: 16,
          }}
        >
          {/* Rank 2 - left, lower */}
          {top3[1] ? (
            <PodiumItem
              rank={2}
              item={top3.find((i) => i.rank === 2) || top3[1]}
              height={120}
              align="end"
            />
          ) : (
            <div />
          )}
          {/* Rank 1 - center, higher */}
          <PodiumItem
            rank={1}
            item={top3.find((i) => i.rank === 1) || top3[0]}
            height={160}
            highlight
          />

          {/* Rank 3 - right, lower */}
          {top3[2] ? (
            <PodiumItem
              rank={3}
              item={top3.find((i) => i.rank === 3) || top3[2]}
              height={110}
              align="start"
            />
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Rest of list */}
      <Stack gap="sm">
        {rest.map((it) => (
          <Group
            key={it.userId}
            justify="space-between"
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
            }}
          >
            <Group>
              <Badge radius="xl" variant="light">
                {it.rank}
              </Badge>
              <Avatar src={it.avatar || undefined} radius="xl" />
              <div>
                <Text fw={600}>{it.fullName || it.username}</Text>
                <Text size="xs" c="dimmed">
                  {it.tier} • Skor {Math.floor(it.score)}
                </Text>
              </div>
            </Group>
          </Group>
        ))}
        {items.length === 0 && (
          <Text c="white">Belum ada data leaderboard</Text>
        )}
      </Stack>
    </Card>
  );
}

function PodiumItem({
  rank,
  item,
  height,
  highlight,
}: {
  rank: 1 | 2 | 3;
  item: {
    userId: string;
    fullName: string;
    username: string;
    avatar: string | null;
    level: number;
    points: number;
    score?: number;
    tier?: string;
  };
  height: number;
  highlight?: boolean;
  align?: "start" | "end";
}) {
  const bg =
    rank === 1
      ? "linear-gradient(135deg,#ffe08a,#ffd54d)"
      : rank === 2
      ? "linear-gradient(135deg,#e6e8ec,#cfd3da)"
      : "linear-gradient(135deg,#e8c7a1,#d49564)";
  const color = "#111";
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div style={{ position: "relative", marginBottom: 8 }}>
        {rank === 1 && (
          <IconCrown
            size={28}
            color="#d4af37"
            style={{
              position: "absolute",
              top: -22,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />
        )}
        <Avatar
          src={item.avatar || undefined}
          radius={999}
          size={68}
          style={{
            border: "3px solid var(--border-color)",
            background: "#fff",
          }}
        />
      </div>
      <div
        style={{
          height,
          width: "80%",
          borderRadius: 10,
          background: bg,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: highlight
            ? "0 8px 24px rgba(0,0,0,.12)"
            : "0 4px 12px rgba(0,0,0,.08)",
        }}
        aria-label={`Peringkat ${rank}`}
      >
        <Group gap={6} align="center">
          <IconTrophy size={16} color={color} />
          <Text size="xl" fw={700}>
            {rank}
          </Text>
        </Group>
      </div>
      <Text mt={8} fw={600} size="sm" ta="center">
        {item.fullName || item.username}
      </Text>
      <Text size="xs" c="dimmed">
        {item.tier} • Skor {Math.floor(item.score || 0)}
      </Text>
    </div>
  );
}

// (replaced with TierCarouselCard)

function TierCarouselCard({
  stats,
}: {
  stats: { xp: number; points: number; coursesCompleted: number };
}) {
  const tiers = useMemo(
    () => [
      {
        key: "newbie",
        title: "Newbie",
        desc: "Pemula yang semangat",
        img: "/rewards/newbie.png",
        thresholds: { xp: 1000, points: 5000, courses: 4 },
        color: "#1e3a8a", // Biru tua
        gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
      },
      {
        key: "explorer",
        title: "Explorer",
        desc: "Penjelajah yang penasaran",
        img: "/rewards/explorer.png",
        thresholds: { xp: 10000, points: 20000, courses: 8 },
        color: "#059669", // Hijau Emerald
        gradient: "linear-gradient(135deg, #059669 0%, #fbbf24 100%)", // Emerald to Gold
      },
      {
        key: "scientist",
        title: "Scientist",
        desc: "Peneliti yang teliti",
        img: "/rewards/scientist.png",
        thresholds: { xp: 20000, points: 40000, courses: 12 },
        color: "#3b82f6", // Biru instead of white
        gradient: "linear-gradient(135deg, #f8fafc 0%, #3b82f6 100%)", // White to Blue
      },
      {
        key: "creative",
        title: "Creative",
        desc: "Kreator yang inovatif",
        img: "/rewards/creative.png",
        thresholds: { xp: 30000, points: 60000, courses: 20 },
        color: "#f97316", // Oranye
        gradient: "linear-gradient(135deg, #f97316 0%, #fbbf24 100%)", // Orange to Gold
      },
      {
        key: "futuristic",
        title: "Futuristic",
        desc: "Visionaris masa depan",
        img: "/rewards/futuristic.png",
        thresholds: { xp: 40000, points: 80000, courses: 32 },
        color: "#94a3b8", // Silver
        gradient: "linear-gradient(135deg, #94a3b8 0%, #06b6d4 100%)", // Silver to Neon Blue
      },
      {
        key: "hero",
        title: "Hero",
        desc: "Pahlawan sejati",
        img: "/rewards/hero.png",
        thresholds: { xp: 50000, points: 100000, courses: 40 },
        color: "#dc2626", // Merah
        gradient: "linear-gradient(135deg, #dc2626 0%, #ffffff 100%)", // Red to White
      },
      {
        key: "master",
        title: "Master",
        desc: "Master yang sempurna",
        img: "/rewards/master.png",
        thresholds: { xp: 60000, points: 120000, courses: 50 },
        color: "#7c3aed", // Ungu
        gradient: "linear-gradient(135deg, #7c3aed 0%, #fbbf24 100%)", // Purple to Gold
      },
    ],
    []
  );

  // Check if a tier is unlocked based on COMPLETING previous tier thresholds
  const isTierUnlocked = useCallback(
    (tier: (typeof tiers)[0], tierIndex: number) => {
      // Newbie is always unlocked (starting tier)
      if (tier.key === "newbie") return true;

      // For other tiers, check if previous tier is completed
      if (tierIndex === 0) return true;

      const previousTier = tiers[tierIndex - 1];
      return (
        stats.xp >= previousTier.thresholds.xp &&
        stats.points >= previousTier.thresholds.points &&
        stats.coursesCompleted >= previousTier.thresholds.courses
      );
    },
    [stats.xp, stats.points, stats.coursesCompleted, tiers]
  );

  // Find current tier (highest unlocked tier)
  const getCurrentTierIndex = useCallback(() => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (isTierUnlocked(tiers[i], i)) {
        return i;
      }
    }
    return 0; // Default to newbie
  }, [tiers, isTierUnlocked]);

  const [idx, setIdx] = useState(() => getCurrentTierIndex());

  // Update index when stats change
  useEffect(() => {
    const currentTierIdx = getCurrentTierIndex();
    setIdx(currentTierIdx);
  }, [getCurrentTierIndex]);

  const t = tiers[idx];
  const isUnlocked = isTierUnlocked(t, idx);

  const go = (dir: -1 | 1) => {
    const n = (idx + dir + tiers.length) % tiers.length;
    setIdx(n);
  };

  const canGoLeft = idx > 0;
  const canGoRight = idx < tiers.length - 1;

  return (
    <Card
      radius="lg"
      withBorder
      p="lg"
      px="xl"
      style={{
        backgroundColor: `${t.color}99`,
        backgroundImage: `
      linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
    `,
        backgroundSize: "24px 24px",
        backgroundBlendMode: "overlay",
        color: "white",
        position: "relative",
      }}
    >
      {/* Level Title and Status */}
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} c="white" mb={4}>
            {t.title}
          </Title>
          <Text c="rgba(255,255,255,0.8)">{t.desc}</Text>
        </div>
      </Group>

      {/* Responsive Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 24,
          alignItems: "center",
        }}
        className="tier-layout"
      >
        {/* Character Image */}
        <div
          style={{
            width: 200,
            height: 200,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <NextImage
            src={t.img}
            alt={t.title}
            width={200}
            height={200}
            style={{
              opacity: isUnlocked ? 1 : 0.4,
              filter: isUnlocked ? "none" : "grayscale(100%) brightness(0)",
            }}
          />

          {/* Lock overlay untuk tier yang belum terbuka */}
          {!isUnlocked && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconLock size={32} color="#374151" />
              </div>
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 16,
            }}
            className="progress-grid"
          >
            {/* XP Progress */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "rgba(255,255,255,0.1)",
              }}
            >
              <Group justify="space-between" mb={8}>
                <Text fw={600} c="white">
                  Total Koin
                </Text>
                <Text size="sm" c="rgba(255,255,255,0.8)">
                  {stats.xp.toLocaleString("id-ID")} /{" "}
                  {t.thresholds.xp.toLocaleString("id-ID")}
                </Text>
              </Group>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (stats.xp / t.thresholds.xp) * 100
                    )}%`,
                    height: "100%",
                    background: "rgba(255,255,255,0.9)",
                    borderRadius: 4,
                    transition: "width 1s ease",
                  }}
                />
              </div>
            </div>

            {/* Points Progress */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "rgba(255,255,255,0.1)",
              }}
            >
              <Group justify="space-between" mb={8}>
                <Text fw={600} c="white">
                  Total Points
                </Text>
                <Text size="sm" c="rgba(255,255,255,0.8)">
                  {stats.points.toLocaleString("id-ID")} /{" "}
                  {t.thresholds.points.toLocaleString("id-ID")}
                </Text>
              </Group>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (stats.points / t.thresholds.points) * 100
                    )}%`,
                    height: "100%",
                    background: "rgba(255,255,255,0.9)",
                    borderRadius: 4,
                    transition: "width 1s ease",
                  }}
                />
              </div>
            </div>

            {/* Courses Progress */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "rgba(255,255,255,0.1)",
              }}
            >
              <Group justify="space-between" mb={8}>
                <Text fw={600} c="white">
                  Kursus Selesai
                </Text>
                <Text size="sm" c="rgba(255,255,255,0.8)">
                  {stats.coursesCompleted} / {t.thresholds.courses}
                </Text>
              </Group>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (stats.coursesCompleted / t.thresholds.courses) * 100
                    )}%`,
                    height: "100%",
                    background: "rgba(255,255,255,0.9)",
                    borderRadius: 4,
                    transition: "width 1s ease",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <Group justify="center" mt="lg" gap="xs">
        {tiers.map((tier, i) => (
          <button
            key={tier.key}
            onClick={() => setIdx(i)}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "none",
              background:
                i === idx
                  ? "white"
                  : isTierUnlocked(tier, i)
                  ? "rgba(255,255,255,0.6)"
                  : "rgba(255,255,255,0.2)",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </Group>

      {/* Navigation Arrows */}
      {canGoLeft && (
        <button
          onClick={() => go(-1)}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "50%",
            width: 48,
            height: 48,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
        >
          <IconChevronLeft size={24} color="white" />
        </button>
      )}

      {canGoRight && (
        <button
          onClick={() => go(1)}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "50%",
            width: 48,
            height: 48,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
        >
          <IconChevronRight size={24} color="white" />
        </button>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .tier-layout {
            flex-direction: column !important;
            text-align: center;
          }

          .progress-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Card>
  );
}
