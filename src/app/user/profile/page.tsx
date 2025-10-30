"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
  ActionIcon,
  Image,
  ScrollArea,
  SimpleGrid,
  Tooltip,
  Progress,
  Skeleton,
  Center,
  Table,
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
  IconExternalLink,
  IconInfoCircle,
  IconRefresh,
  IconCoin,
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
      | "leaderboard"
      | "certificates"
      | "scratch-projects"
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
  const [errors, setErrors] = useState<{
    username?: string;
    phone?: string;
    bio?: string;
  }>({});

  // Validation functions
  const validateUsername = async (value: string) => {
    // Skip validation if no change
    if (value === initialRef.current?.username) {
      setErrors((prev) => ({ ...prev, username: undefined }));
      return true;
    }

    // Basic validations
    if (value.length < 3) {
      setErrors((prev) => ({
        ...prev,
        username: "Username minimal 3 karakter",
      }));
      return false;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
      setErrors((prev) => ({
        ...prev,
        username: "Username hanya boleh huruf, angka, titik, dan underscore",
      }));
      return false;
    }

    // Check uniqueness via API
    try {
      const res = await fetch(
        `/api/user/profile/validate?username=${encodeURIComponent(
          value
        )}&excludeId=${encodeURIComponent(user?.id || "")}`
      );
      const json = await res.json();
      if (!json.valid) {
        setErrors((prev) => ({ ...prev, username: json.error }));
        return false;
      }
      setErrors((prev) => ({ ...prev, username: undefined }));
      return true;
    } catch (error) {
      setErrors((prev) => ({ ...prev, username: "Gagal validasi username" }));
      return false;
    }
  };

  const validatePhone = async (value: string) => {
    // Skip validation if no value (phone is optional) or no change
    if (!value) {
      setErrors((prev) => ({ ...prev, phone: undefined }));
      return true;
    }
    if (value === initialRef.current?.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }));
      return true;
    }

    // Basic validations
    if (!/^\+?\d+$/.test(value)) {
      setErrors((prev) => ({
        ...prev,
        phone: "Nomor telepon hanya boleh angka dan tanda +",
      }));
      return false;
    }
    const phoneDigits = value.replace(/^\+/, "");
    if (phoneDigits.length < 10) {
      setErrors((prev) => ({
        ...prev,
        phone: "Nomor telepon minimal 10 digit",
      }));
      return false;
    }

    // Check uniqueness via API
    try {
      const res = await fetch(
        `/api/user/profile/validate?phone=${encodeURIComponent(
          value
        )}&excludeId=${encodeURIComponent(user?.id || "")}`
      );
      const json = await res.json();
      if (!json.valid) {
        setErrors((prev) => ({ ...prev, phone: json.error }));
        return false;
      }
      setErrors((prev) => ({ ...prev, phone: undefined }));
      return true;
    } catch (error) {
      setErrors((prev) => ({ ...prev, phone: "Gagal validasi nomor telepon" }));
      return false;
    }
  };

  const validateBio = (value: string) => {
    if (value.length > 300) {
      setErrors((prev) => ({ ...prev, bio: "Bio maksimal 300 karakter" }));
      return false;
    }
    setErrors((prev) => ({ ...prev, bio: undefined }));
    return true;
  };

  // server data
  // numeric level no longer used; tier derived from xp/points/courses
  const [points, setPoints] = useState<number>(user?.points ?? 0);
  // const [balance, setBalance] = useState<number>(user?.balance ?? 0);
  const [currentXP, setCurrentXP] = useState<number>(0);
  const [, setNextLevelXP] = useState<number>(1500);
  const [coursesCompleted, setCoursesCompleted] = useState<number>(0);
  const [coins, setCoins] = useState(0);

  // School score from leaderboard (for school role)
  const [schoolScore, setSchoolScore] = useState<number>(0);

  const avgScore = useMemo(() => {
    if (user?.role === "school") {
      // For school: use score from leaderboard calculation
      return Math.floor(schoolScore);
    }
    // For user: calculate from own points and coins
    return Math.floor((Number(points || 0) + Number(coins || 0)) / 2);
  }, [user?.role, coins, points, schoolScore]);
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
      method?: string | null;
    }[]
  >([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const txLimit = 10;
  const [certificates, setCertificates] = useState<
    { id: string; courseTitle: string; date: string; url: string | null }[]
  >([]);

  // Scratch projects state
  const [scratchProjects, setScratchProjects] = useState<any[]>([]);
  const [scratchProjectsLoading, setScratchProjectsLoading] = useState(false);

  // Achievements state
  const [achievements, setAchievements] = useState<
    { achievement_key: string; coins_earned: number; earned_at: string }[]
  >([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);

  // Purchases and Certificates loading states
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [certificatesLoading, setCertificatesLoading] = useState(false);

  // Leaderboard state (for school role)
  const [leaderboardItems, setLeaderboardItems] = useState<
    {
      rank: number;
      userId: string;
      name: string;
      avatar: string | null;
      score: number;
    }[]
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);

  // School score (calculated from students' total points + coins)
  const [schoolTotalPoints, setSchoolTotalPoints] = useState(0);
  const [schoolTotalCoins, setSchoolTotalCoins] = useState(0);

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

  const displayMethod = (method?: string | null) => {
    if (!method) return "Metode Tidak Diketahui";
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
    method?: string | null;
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
  ${line(pad("Metode: ", displayMethod(t.method || undefined)))}
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
        setPurchasesLoading(true);
        let txUrl = "";
        if (user?.role === "school") {
          txUrl = `/api/school/transactions?schoolId=${user.id}&page=${txPage}&limit=${txLimit}&sortBy=date&sortDir=desc`;
        } else {
          txUrl = `/api/user/transactions?userId=${user.id}&page=${txPage}&limit=${txLimit}&sortBy=date&sortDir=desc`;
        }
        const tr = await fetch(txUrl);
        const tj = await tr.json();
        if (tr.ok && tj.success) {
          type ApiTx = {
            id: string;
            date: string;
            course_title: string;
            amount: number;
            status: string;
            method?: string | null;
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
              method: r.method ?? null,
            }))
          );
          setTxTotal(Number(tj.total || items.length));
        } else {
          setLatestPaid([]);
          setTxTotal(0);
        }
        setPurchasesLoading(false);

        // certificates
        setCertificatesLoading(true);
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
        setCertificatesLoading(false);

        // Scratch projects - hanya untuk user yang sedang login
        if (user.username) {
          setScratchProjectsLoading(true);
          try {
            const sp = await fetch(
              `/api/scratch/projects?username=${encodeURIComponent(
                user.username
              )}&userId=${user.id}`
            );
            const spj = await sp.json();
            if (sp.ok && spj.success) {
              setScratchProjects(spj.projects || []);
            } else {
              setScratchProjects([]);
            }
          } catch {
            setScratchProjects([]);
          } finally {
            setScratchProjectsLoading(false);
          }
        }

        // Load achievements and coins
        setAchievementsLoading(true);
        try {
          const [achievRes, statsRes] = await Promise.all([
            fetch(`/api/user/achievements?userId=${user.id}`),
            fetch(`/api/user/stats?userId=${user.id}`),
          ]);

          if (achievRes.ok) {
            const achievJson = await achievRes.json();
            if (achievJson.success) {
              setAchievements(achievJson.achievements || []);
            }
          }

          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            if (statsJson.success) {
              setCoins(Number(statsJson.coins || 0));
              setCoursesCompleted(Number(statsJson.coursesCompleted || 0));
            }
          }
        } catch {
          // ignore error
        } finally {
          setAchievementsLoading(false);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memuat profil");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.username, txPage]);

  // Fetch leaderboard data for school role
  useEffect(() => {
    if (user?.role !== "school") return;

    const fetchLeaderboard = async () => {
      // Only show loading spinner if we're on the leaderboard tab
      if (activeTab === "leaderboard") {
        setLeaderboardLoading(true);
      }

      try {
        const res = await fetch(`/api/school/leaderboard`);
        const data = await res.json();
        if (res.ok && data.success) {
          // Always set leaderboard items for the tab
          if (activeTab === "leaderboard") {
            setLeaderboardItems(data.items || []);
          }

          // Always find and set current school's score for the header
          const currentSchool = (data.items || []).find(
            (item: any) => item.userId === user.id
          );
          if (currentSchool) {
            setSchoolScore(currentSchool.score);
          }
        } else {
          if (activeTab === "leaderboard") {
            setLeaderboardItems([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        if (activeTab === "leaderboard") {
          setLeaderboardItems([]);
        }
      } finally {
        if (activeTab === "leaderboard") {
          setLeaderboardLoading(false);
        }
      }
    };

    fetchLeaderboard();
  }, [user?.role, user?.id, activeTab]);

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

    // Validate all fields before saving
    const usernameValid = await validateUsername(username);
    const phoneValid = await validatePhone(phone);
    const bioValid = validateBio(bio);

    if (!usernameValid || !phoneValid || !bioValid) {
      notifications.show({
        title: "Validasi Gagal",
        message: "Silakan periksa kembali input yang tidak valid",
        color: "red",
      });
      return;
    }

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
      notifications.show({
        title: "Berhasil",
        message: "Profil berhasil disimpan",
        color: "green",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
      notifications.show({
        title: "Gagal",
        message: e instanceof Error ? e.message : "Gagal menyimpan profil",
        color: "red",
      });
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
          href={`/${user?.role || "user"}/dashboard`}
          size="md"
          radius="xl"
          style={{ fontWeight: 500, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
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
        <Stack gap="md">
          {/* Mobile & Tablet: Stack vertically */}
          <Group
            justify="space-between"
            align="flex-start"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            {/* Avatar and Info Container */}
            <Group align="flex-start" style={{ flex: 1, minWidth: "250px" }}>
              <Avatar
                size={110}
                radius="xl"
                src={user.avatar}
                style={{
                  border: "4px solid var(--primary-color)",
                  flexShrink: 0,
                }}
              >
                {user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title
                  order={2}
                  c="white"
                  mb={6}
                  style={{ wordBreak: "break-word" }}
                >
                  {fullName || user.fullName}
                </Title>
                <Stack gap="xs">
                  {user?.role === "user" && (
                    <Badge
                      bg="var(--secondary-color)"
                      variant="filled"
                      radius="xl"
                      c="var(--primary-color)"
                      style={{ width: "fit-content" }}
                    >
                      Tier{" "}
                      {getTier(
                        currentXP,
                        points,
                        coursesCompleted
                      ).toUpperCase()}
                    </Badge>
                  )}
                  <Badge
                    color="var(--secondary-color)"
                    variant="light"
                    radius="xl"
                    style={{ width: "fit-content" }}
                  >
                    Skor {avgScore}
                  </Badge>
                </Stack>
              </div>
            </Group>

            {/* Avatar Button */}
            <div style={{ flexShrink: 0 }}>
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
                fullWidth
                style={{ minWidth: "150px" }}
              >
                Ganti Avatar
              </Button>
            </div>
          </Group>
        </Stack>
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
                  label={
                    user?.role === "school" ? "Nama Sekolah" : "Nama Lengkap"
                  }
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
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setUsername(value);
                    validateUsername(value);
                  }}
                  onBlur={() => validateUsername(username)}
                  error={errors.username}
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
                  placeholder="+628123456789"
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setPhone(value);
                    validatePhone(value);
                  }}
                  onBlur={() => validatePhone(phone)}
                  error={errors.phone}
                  radius="md"
                  size="md"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Bio"
                  value={bio}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setBio(value);
                    validateBio(value);
                  }}
                  onBlur={() => validateBio(bio)}
                  error={errors.bio}
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
          <>
            {achievementsLoading ? (
              <Stack gap="xl">
                {/* Header Skeleton */}
                <Group justify="space-between" align="center">
                  <Stack gap="xs">
                    <Skeleton height={28} width={200} radius="md" />
                    <Skeleton height={20} width={300} radius="md" />
                  </Stack>
                  <Skeleton height={60} width={120} radius="xl" />
                </Group>

                {/* Coin Badge Grid Skeleton */}
                <Stack gap="md">
                  <Skeleton height={80} radius="md" />
                  <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="md">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} height={120} radius="md" />
                    ))}
                  </SimpleGrid>
                </Stack>

                {/* Achievements Grid Skeleton */}
                <Stack gap="md">
                  <Group justify="space-between">
                    <Skeleton height={24} width={200} radius="md" />
                    <Skeleton height={20} width={60} radius="md" />
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} height={280} radius="lg" />
                    ))}
                  </SimpleGrid>
                  <SimpleGrid
                    cols={{ base: 1, sm: 2 }}
                    spacing="lg"
                    style={{ maxWidth: "66%", margin: "0 auto" }}
                  >
                    {[...Array(2)].map((_, i) => (
                      <Skeleton key={i} height={280} radius="lg" />
                    ))}
                  </SimpleGrid>
                </Stack>

                {/* Second Coin Badge Grid Skeleton */}
                <Stack gap="md">
                  <Skeleton height={80} radius="md" />
                  <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="md">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={`second-${i}`} height={120} radius="md" />
                    ))}
                  </SimpleGrid>
                </Stack>

                {/* Tier Carousel Skeleton */}
                <Skeleton height={300} radius="lg" />

                {/* Leaderboard has its own loading state */}
                {user?.role === "school" ? (
                  <SchoolLeaderboard />
                ) : (
                  <Leaderboard />
                )}
              </Stack>
            ) : (
              <Stack gap="xl">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={3} c="var(--primary-color)">
                      Pencapaian & Koin
                    </Title>
                    <Text c="dimmed">
                      Kumpulkan koin dengan menyelesaikan pencapaian
                    </Text>
                  </div>
                  <Card
                    withBorder
                    radius="xl"
                    p="md"
                    bg="var(--secondary-color)"
                  >
                    <Group gap="xs">
                      <Text size="xl" fw={700} c="var(--primary-color)">
                        {coins.toLocaleString("id-ID")}
                      </Text>
                      <Text size="sm" c="var(--primary-color)">
                        Koin
                      </Text>
                    </Group>
                  </Card>
                </Group>

                <CoinBadgeGrid coins={coins} />

                {/* Achievements Grid */}
                <AchievementsGrid
                  achievements={achievements}
                  stats={{ xp: currentXP, points, coursesCompleted }}
                  coins={coins}
                />

                <CoinBadgeGrid coins={coins} />

                {user?.role !== "school" && (
                  <TierCarouselCard
                    stats={{ coins, points, coursesCompleted }}
                  />
                )}

                {/* Leaderboard Top 5 */}
                {user?.role === "school" ? (
                  <SchoolLeaderboard />
                ) : (
                  <Leaderboard />
                )}
              </Stack>
            )}
          </>
        )}

        {activeTab === "purchases" && (
          <Stack gap="lg">
            <Title order={3} c="var(--primary-color)">
              Riwayat Pembelian
            </Title>
            {purchasesLoading ? (
              <Stack gap="md">
                <Skeleton height={120} radius="md" />
                <Skeleton height={120} radius="md" />
                <Skeleton height={120} radius="md" />
              </Stack>
            ) : (
              <>
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
                      disabled={
                        txPage >= Math.max(1, Math.ceil(txTotal / txLimit))
                      }
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
                          <IconCalendar
                            size={16}
                            color="var(--primary-color)"
                          />
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
              </>
            )}
          </Stack>
        )}

        {activeTab === "leaderboard" && user?.role === "school" && (
          <Stack gap="lg">
            <Title order={3} c="var(--primary-color)">
              Leaderboard Sekolah
            </Title>
            {leaderboardLoading ? (
              <Stack gap="md">
                <Skeleton height={200} radius="md" />
                <Skeleton height={300} radius="md" />
              </Stack>
            ) : (
              <>
                {/* Top 3 Podium - Proper positioning with alignItems */}
                {leaderboardItems.length >= 3 && (
                  <SimpleGrid
                    cols={{ base: 1, md: 3 }}
                    spacing="lg"
                    mb="xl"
                    style={{ alignItems: "end" }}
                  >
                    {/* 2nd Place (Silver) - Left, Lower */}
                    <Card
                      withBorder
                      radius="xl"
                      p="xl"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(192, 192, 192, 0.2) 0%, rgba(192, 192, 192, 0.05) 100%)",
                        borderColor: "#C0C0C0",
                        minHeight: "240px",
                        marginTop: "2rem",
                      }}
                    >
                      <Stack align="center" gap="md">
                        <Badge
                          size="xl"
                          radius="xl"
                          style={{
                            background: "#C0C0C0",
                            color: "#000",
                          }}
                        >
                          #2
                        </Badge>
                        <Avatar
                          src={leaderboardItems[1]?.avatar}
                          size={80}
                          radius="xl"
                        />
                        <div style={{ textAlign: "center" }}>
                          <Text fw={700} size="lg" c="black">
                            {leaderboardItems[1]?.name}
                          </Text>
                        </div>
                        <Badge color="gray" variant="light" mt={8}>
                          {leaderboardItems[1]?.score.toFixed(0)} Poin
                        </Badge>
                      </Stack>
                    </Card>

                    {/* 1st Place (Gold) - Center, Highest */}
                    <Card
                      withBorder
                      radius="xl"
                      p="xl"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 100%)",
                        borderColor: "#FFD700",
                        minHeight: "280px",
                      }}
                    >
                      <Stack align="center" gap="md">
                        <IconCrown size={36} color="#FFD700" />
                        <Badge
                          size="xl"
                          radius="xl"
                          style={{
                            background: "#FFD700",
                            color: "#000",
                          }}
                        >
                          #1
                        </Badge>
                        <Avatar
                          src={leaderboardItems[0]?.avatar}
                          size={100}
                          radius="xl"
                        />
                        <div style={{ textAlign: "center" }}>
                          <Text fw={700} size="xl" c="black">
                            {leaderboardItems[0]?.name}
                          </Text>
                        </div>
                        <Badge color="yellow" variant="light" mt={8}>
                          {leaderboardItems[0]?.score.toFixed(0)} Poin
                        </Badge>
                      </Stack>
                    </Card>

                    {/* 3rd Place (Bronze) - Right, Lower */}
                    <Card
                      withBorder
                      radius="xl"
                      p="xl"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(205, 127, 50, 0.2) 0%, rgba(205, 127, 50, 0.05) 100%)",
                        borderColor: "#CD7F32",
                        minHeight: "240px",
                        marginTop: "2rem",
                      }}
                    >
                      <Stack align="center" gap="md">
                        <Badge
                          size="xl"
                          radius="xl"
                          style={{
                            background: "#CD7F32",
                            color: "#fff",
                          }}
                        >
                          #3
                        </Badge>
                        <Avatar
                          src={leaderboardItems[2]?.avatar}
                          size={80}
                          radius="xl"
                        />
                        <div style={{ textAlign: "center" }}>
                          <Text fw={700} size="lg" c="black">
                            {leaderboardItems[2]?.name}
                          </Text>
                        </div>
                        <Badge color="orange" variant="light" mt={8}>
                          {leaderboardItems[2]?.score.toFixed(0)} Poin
                        </Badge>
                      </Stack>
                    </Card>
                  </SimpleGrid>
                )}

                {/* Rest of Schools Table (from rank 4+) */}
                {leaderboardItems.length > 3 && (
                  <Card
                    withBorder
                    radius="lg"
                    p="md"
                    style={{ overflowX: "auto" }}
                  >
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ minWidth: "100px" }}>
                            Peringkat
                          </Table.Th>
                          <Table.Th style={{ minWidth: "250px" }}>
                            Sekolah
                          </Table.Th>
                          <Table.Th
                            style={{ textAlign: "right", minWidth: "100px" }}
                          >
                            Skor
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {leaderboardItems
                          .slice(3, showAllLeaderboard ? undefined : 8)
                          .map((item) => (
                            <Table.Tr key={item.userId}>
                              <Table.Td>
                                <Badge color="blue" variant="light" radius="xl">
                                  #{item.rank}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Group gap="sm" wrap="nowrap">
                                  <Avatar
                                    src={item.avatar}
                                    size={40}
                                    radius="xl"
                                  />
                                  <Text
                                    fw={500}
                                    style={{ wordBreak: "break-word" }}
                                  >
                                    {item.name}
                                  </Text>
                                </Group>
                              </Table.Td>
                              <Table.Td style={{ textAlign: "right" }}>
                                <Text fw={600}>{item.score.toFixed(0)}</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                      </Table.Tbody>
                    </Table>
                    {leaderboardItems.length > 8 && !showAllLeaderboard && (
                      <Button
                        fullWidth
                        variant="light"
                        mt="md"
                        onClick={() => setShowAllLeaderboard(true)}
                      >
                        Lihat Selengkapnya
                      </Button>
                    )}
                    {showAllLeaderboard && leaderboardItems.length > 8 && (
                      <Button
                        fullWidth
                        variant="light"
                        mt="md"
                        onClick={() => setShowAllLeaderboard(false)}
                      >
                        Tampilkan Lebih Sedikit
                      </Button>
                    )}
                  </Card>
                )}

                {leaderboardItems.length === 0 && (
                  <Text c="white" ta="center" py="xl">
                    Belum ada data leaderboard
                  </Text>
                )}
              </>
            )}
          </Stack>
        )}

        {activeTab === "certificates" && (
          <Stack gap="lg">
            <Title order={3} c="var(--primary-color)">
              Sertifikat Kursus
            </Title>
            {certificatesLoading ? (
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Skeleton height={400} radius="xl" />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Skeleton height={400} radius="xl" />
                </Grid.Col>
              </Grid>
            ) : (
              <>
                <Grid gutter="lg">
                  {certificates.map((cert) => (
                    <Grid.Col key={cert.id} span={{ base: 12, md: 6 }}>
                      <Card
                        withBorder
                        radius="xl"
                        p="lg"
                        className="card-hover"
                      >
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
                            <IconAward
                              size={32}
                              color="var(--secondary-color)"
                            />
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
                                <IconEye
                                  size={32}
                                  style={{ marginBottom: 8 }}
                                />
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
                                      throw new Error(
                                        "Gagal mengunduh sertifikat"
                                      );
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
              </>
            )}
          </Stack>
        )}

        {activeTab === "scratch-projects" && (
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} c="var(--primary-color)">
                  Proyek Scratch Saya
                </Title>
                <Text c="dimmed">
                  Proyek Scratch yang telah Anda buat dan publikasikan
                </Text>
              </div>
              <Group>
                <Tooltip label="Refresh">
                  <ActionIcon
                    variant="light"
                    onClick={async () => {
                      if (!user?.username) return;
                      setScratchProjectsLoading(true);
                      try {
                        const sp = await fetch(
                          `/api/scratch/projects?username=${encodeURIComponent(
                            user.username
                          )}&userId=${user.id}`
                        );
                        const spj = await sp.json();
                        if (sp.ok && spj.success) {
                          setScratchProjects(spj.projects || []);
                        }
                      } catch {
                        // ignore error
                      } finally {
                        setScratchProjectsLoading(false);
                      }
                    }}
                    aria-label="refresh"
                  >
                    <IconRefresh size={18} />
                  </ActionIcon>
                </Tooltip>
                <Button
                  leftSection={<IconExternalLink size={16} />}
                  onClick={() =>
                    window.open("https://scratch.mit.edu/", "_blank")
                  }
                >
                  Buka Scratch
                </Button>
              </Group>
            </Group>

            {/* Info Box */}
            <Card withBorder radius="md" p="sm" bg="blue.0">
              <Group align="flex-start" gap="sm">
                <IconInfoCircle
                  size={20}
                  color="var(--mantine-color-blue-filled)"
                />
                <Text size="sm" c="blue.8">
                  Pastikan proyek Scratch Anda sudah diset <b>Publik</b> agar
                  dapat tampil di daftar proyek. Proyek yang masih{" "}
                  <i>Private</i> tidak akan muncul di sini.
                </Text>
              </Group>
            </Card>

            {/* Content */}
            {scratchProjectsLoading ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                <Skeleton height={280} radius="md" />
                <Skeleton height={280} radius="md" />
                <Skeleton height={280} radius="md" />
                <Skeleton height={280} radius="md" />
              </SimpleGrid>
            ) : !user?.username ? (
              <Card withBorder p="md">
                <Text>
                  Username akun Anda akan digunakan sebagai username Scratch.
                  Pastikan username Anda sama dengan akun Scratch.
                </Text>
              </Card>
            ) : (
              <ScrollArea h="calc(100vh - 400px)">
                <SimpleGrid
                  cols={{ base: 1, sm: 2, md: 3, lg: 4 }}
                  spacing="md"
                >
                  {scratchProjects.length > 0 ? (
                    scratchProjects.map((p: any) => {
                      const desc =
                        p.description?.trim() ||
                        p.instructions?.trim() ||
                        p.details?.trim() ||
                        "";

                      return (
                        <Card
                          key={p.id}
                          withBorder
                          shadow="sm"
                          radius="md"
                          p="md"
                        >
                          <Stack gap={8}>
                            <Image
                              src={
                                p.image ||
                                p.image_url ||
                                `https://uploads.scratch.mit.edu/projects/${p.id}/thumbnail.png`
                              }
                              alt={p.title || `Project ${p.id}`}
                              height={160}
                              onError={() => {}}
                            />

                            <Group justify="space-between" align="flex-start">
                              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                                <Text fw={600} lineClamp={2}>
                                  {p.title || `Project ${p.id}`}
                                </Text>

                                <Text size="sm" c="dimmed" lineClamp={3}>
                                  {desc || "Tidak ada deskripsi."}
                                </Text>
                              </Stack>

                              <ActionIcon
                                variant="subtle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    `https://scratch.mit.edu/projects/${p.id}`,
                                    "_blank"
                                  );
                                }}
                                aria-label="open-external"
                              >
                                <IconExternalLink size={16} />
                              </ActionIcon>
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })
                  ) : (
                    <Card withBorder shadow="sm" p="xl" radius="md">
                      <Stack align="center" gap="sm">
                        <Text size="sm" c="dimmed">
                          Belum ada proyek publik di akun Scratch ini.
                        </Text>
                      </Stack>
                    </Card>
                  )}
                </SimpleGrid>
              </ScrollArea>
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

  if (loading) {
    return (
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3} c="var(--primary-color)">
            Leaderboard Siswa
          </Title>
          <Text size="sm" c="dimmed">
            Urutan berdasarkan rata-rata tiga kategori
          </Text>
          <Stack gap="sm">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={80} radius="md" />
            ))}
          </Stack>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="lg" p="lg">
        <Text c="red">{error}</Text>
      </Card>
    );
  }

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
        overflowX: "auto",
        maxWidth: "100vw",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" mb="xs" wrap="wrap">
          <div>
            <Title order={4} c="var(--primary-color)">
              Leaderboard Siswa
            </Title>
            <Text size="sm" c="dimmed">
              Urutan berdasarkan rata-rata tiga kategori
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Tampilkan Top 5" : "Lihat Semua"}
          </Button>
        </Group>

        {/* Podium */}
        {top3.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              alignItems: "end",
              marginBottom: 16,
              minWidth: 320,
            }}
            className="podium-grid"
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
              wrap="wrap"
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
                gap: 8,
              }}
            >
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <Badge radius="xl" variant="light" style={{ flexShrink: 0 }}>
                  {it.rank}
                </Badge>
                <Avatar
                  src={it.avatar || undefined}
                  radius="xl"
                  size="md"
                  style={{ flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text
                    fw={600}
                    lineClamp={1}
                    style={{ wordBreak: "break-word" }}
                  >
                    {it.fullName || it.username}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
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
      </Stack>

      <style jsx>{`
        @media (max-width: 640px) {
          .podium-grid {
            gap: 8px !important;
            min-width: 320px;
          }
          .podium-item {
            min-width: 90px;
          }
        }
      `}</style>
    </Card>
  );
}

// School-only leaderboard (scoped to the school's students, no tier display)
function SchoolLeaderboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<
    {
      rank: number;
      userId: string;
      fullName: string;
      username: string;
      avatar: string | null;
      level: number;
      points: number;
      xp: number;
      coursesCompleted: number;
      score: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/school/leaderboard?schoolUserId=${user.id}&limit=${
            showAll ? 20 : 5
          }&page=1`
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat leaderboard sekolah");
        setItems(json.items || []);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Gagal memuat leaderboard sekolah"
        );
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.id, showAll]);

  if (loading) {
    return (
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3} c="var(--primary-color)">
            Leaderboard Siswa Sekolah
          </Title>
          <Text size="sm" c="dimmed">
            Urutan berdasarkan rata-rata tiga kategori
          </Text>
          <Stack gap="sm">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={80} radius="md" />
            ))}
          </Stack>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="lg" p="lg">
        <Text c="red">{error}</Text>
      </Card>
    );
  }

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
        overflowX: "auto",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" mb="xs" wrap="wrap">
          <div>
            <Title order={4} c="var(--primary-color)">
              Leaderboard Siswa Sekolah
            </Title>
            <Text size="sm" c="dimmed">
              Urutan berdasarkan rata-rata tiga kategori
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Tampilkan Top 5" : "Lihat Semua"}
          </Button>
        </Group>

        {top3.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              alignItems: "end",
              marginBottom: 16,
              minWidth: 320,
            }}
            className="podium-grid"
          >
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
            <PodiumItem
              rank={1}
              item={top3.find((i) => i.rank === 1) || top3[0]}
              height={160}
              highlight
            />
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

        <Stack gap="sm">
          {rest.map((it) => (
            <Group
              key={it.userId}
              justify="space-between"
              wrap="wrap"
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
                gap: 8,
              }}
            >
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <Badge radius="xl" variant="light" style={{ flexShrink: 0 }}>
                  {it.rank}
                </Badge>
                <Avatar
                  src={it.avatar || undefined}
                  radius="xl"
                  size="md"
                  style={{ flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text
                    fw={600}
                    lineClamp={1}
                    style={{ wordBreak: "break-word" }}
                  >
                    {it.fullName || it.username}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    Skor {Math.floor(it.score)}
                  </Text>
                </div>
              </Group>
            </Group>
          ))}
          {items.length === 0 && (
            <Text c="white">Belum ada data leaderboard</Text>
          )}
        </Stack>
      </Stack>

      <style jsx>{`
        @media (max-width: 640px) {
          .podium-grid {
            gap: 8px !important;
            min-width: 320px;
          }
          .podium-item {
            min-width: 90px;
          }
        }
      `}</style>
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
      className="podium-item"
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
            className="crown-icon"
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
          className="podium-avatar"
        />
      </div>
      <div
        style={{
          height,
          width: "80%",
          minWidth: 60,
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
        className="podium-base"
      >
        <Group gap={6} align="center">
          <IconTrophy size={16} color={color} className="trophy-icon" />
          <Text size="xl" fw={700}>
            {rank}
          </Text>
        </Group>
      </div>
      <Text
        mt={8}
        fw={600}
        size="sm"
        ta="center"
        lineClamp={1}
        style={{ width: "100%", wordBreak: "break-word" }}
      >
        {item.fullName || item.username}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={1}>
        {item.tier} • Skor {Math.floor(item.score || 0)}
      </Text>

      <style jsx>{`
        @media (max-width: 640px) {
          .podium-item .podium-avatar {
            width: 48px !important;
            height: 48px !important;
          }
          .podium-item .crown-icon {
            width: 20px !important;
            height: 20px !important;
            top: -18px !important;
          }
          .podium-item .trophy-icon {
            width: 12px !important;
            height: 12px !important;
          }
          .podium-base {
            min-height: 80px !important;
          }
        }
      `}</style>
    </div>
  );
}

// (replaced with TierCarouselCard)

// Achievement definitions matching the API
const ACHIEVEMENTS_CONFIG = [
  {
    key: "first_step",
    name: "Langkah Pertama",
    desc: "Badge awal: terbuka otomatis saat kamu mulai mengumpulkan koin.",
    coins: 0,
    image: "1.png",
    category: "coin",
  },
  {
    key: "knowledge_seeker",
    name: "Pencari Ilmu",
    desc: "Capai 1.000 koin untuk membuka pencapaian ini.",
    coins: 1000,
    image: "2.png",
    category: "coin",
  },
  {
    key: "dedicated_learner",
    name: "Pembelajar Tekun",
    desc: "Capai 3.000 koin untuk membuka pencapaian ini.",
    coins: 3000,
    image: "3.png",
    category: "coin",
  },
  {
    key: "quiz_master",
    name: "Penjelajah Materi",
    desc: "Capai 5.000 koin untuk membuka pencapaian ini.",
    coins: 5000,
    image: "4.png",
    category: "coin",
  },
  {
    key: "perfect_score",
    name: "Pencetak Prestasi",
    desc: "Capai 7.000 koin untuk membuka pencapaian ini.",
    coins: 7000,
    image: "5.png",
    category: "coin",
  },
  {
    key: "assignment_pro",
    name: "Pengumpul Aktif",
    desc: "Capai 9.000 koin untuk membuka pencapaian ini.",
    coins: 9000,
    image: "6.png",
    category: "coin",
  },
  {
    key: "discussion_star",
    name: "Penggiat Diskusi",
    desc: "Capai 12.000 koin untuk membuka pencapaian ini.",
    coins: 12000,
    image: "7.png",
    category: "coin",
  },
  {
    key: "helper",
    name: "Pelatih Mandiri",
    desc: "Capai 15.000 koin untuk membuka pencapaian ini.",
    coins: 15000,
    image: "8.png",
    category: "coin",
  },
  {
    key: "early_bird",
    name: "Kolektor Berdedikasi",
    desc: "Capai 20.000 koin untuk membuka pencapaian ini.",
    coins: 20000,
    image: "9.png",
    category: "coin",
  },
  {
    key: "consistent",
    name: "Pejuang Koin",
    desc: "Capai 25.000 koin untuk membuka pencapaian ini.",
    coins: 25000,
    image: "10.png",
    category: "coin",
  },
  {
    key: "code_creator",
    name: "Penguasa Kelas",
    desc: "Capai 30.000 koin untuk membuka pencapaian ini.",
    coins: 30000,
    image: "11.png",
    category: "coin",
  },
  {
    key: "rating_giver",
    name: "Mentor Afterschola",
    desc: "Capai 35.000 koin untuk membuka pencapaian ini.",
    coins: 35000,
    image: "12.png",
    category: "coin",
  },
  {
    key: "marathon",
    name: "Inspirator Kelas",
    desc: "Capai 40.000 koin untuk membuka pencapaian ini.",
    coins: 40000,
    image: "13.png",
    category: "coin",
  },
  {
    key: "explorer_tier",
    name: "Maestro Ilmu",
    desc: "Capai 50.000 koin untuk membuka pencapaian ini.",
    coins: 50000,
    image: "14.png",
    category: "coin",
  },
  {
    key: "master_tier",
    name: "Legenda Afterschola",
    desc: "Capai 60.000 koin untuk membuka pencapaian ini.",
    coins: 60000,
    image: "15.png",
    category: "coin",
  },
];

const COIN_BADGES = [
  {
    key: "coin_0",
    name: "Langkah Pertama",
    desc: "Badge awal: terbuka otomatis saat kamu punya 0 koin.",
    threshold: 0,
    image: "/coins/1.png",
    highlight: "#f97316",
  },
  {
    key: "coin_1000",
    name: "Pencari Ilmu",
    desc: "Capai 1.000 koin untuk membuka badge ini.",
    threshold: 1000,
    image: "/coins/2.png",
    highlight: "#6b7280",
  },
  {
    key: "coin_5000",
    name: "Pembelajar Gigih",
    desc: "Capai 5.000 koin untuk membuka badge ini.",
    threshold: 5000,
    image: "/coins/3.png",
    highlight: "#facc15",
  },
  {
    key: "coin_15000",
    name: "Kolektor Berdedikasi",
    desc: "Capai 15.000 koin untuk membuka badge ini.",
    threshold: 15000,
    image: "/coins/4.png",
    highlight: "#38bdf8",
  },
  {
    key: "coin_30000",
    name: "Master Pembelajar",
    desc: "Capai 30.000 koin untuk membuka badge ini.",
    threshold: 30000,
    image: "/coins/5.png",
    highlight: "#8b5cf6",
  },
  {
    key: "coin_60000",
    name: "Legenda Afterschola",
    desc: "Capai 60.000 koin untuk membuka badge tertinggi ini.",
    threshold: 60000,
    image: "/coins/6.png",
    highlight: "#ef4444",
  },
] as const;

function CoinBadgeGrid({ coins }: { coins: number }) {
  const [selectedBadge, setSelectedBadge] = useState<
    (typeof COIN_BADGES)[number] | null
  >(null);

  const unlocked = COIN_BADGES.filter((badge) => coins >= badge.threshold);
  const maxThreshold = COIN_BADGES[COIN_BADGES.length - 1].threshold;
  const progressPercent = Math.min(
    100,
    Math.round((coins / maxThreshold) * 100)
  );

  const handleActivateBadge =
    (badge: (typeof COIN_BADGES)[number]) =>
    (event: ReactKeyboardEvent | ReactMouseEvent) => {
      if (
        "key" in event &&
        event.key !== "Enter" &&
        event.key !== " " &&
        event.key !== "Spacebar"
      ) {
        return;
      }
      event.preventDefault();
      setSelectedBadge(badge);
    };

  return (
    <>
      <Modal
        opened={Boolean(selectedBadge)}
        onClose={() => setSelectedBadge(null)}
        title={
          <Text fw={700} size="lg" style={{ color: "var(--primary-color)" }}>
            {selectedBadge?.name}
          </Text>
        }
        centered
        size="md"
        styles={{
          header: {
            borderBottom: "2px solid var(--secondary-color)",
            paddingBottom: 12,
          },
        }}
      >
        {selectedBadge && (
          <Stack gap="lg">
            <Group gap="lg" align="center" wrap="nowrap">
              <div
                style={{
                  position: "relative",
                  width: 120,
                  height: 120,
                  borderRadius: 16,
                  background:
                    coins >= selectedBadge.threshold
                      ? "var(--primary-color)"
                      : "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                  transition: "all 0.3s ease",
                }}
              >
                <NextImage
                  src={selectedBadge.image}
                  alt={selectedBadge.name}
                  width={96}
                  height={96}
                  style={{
                    filter:
                      coins >= selectedBadge.threshold
                        ? "none"
                        : "grayscale(100%) opacity(0.5)",
                  }}
                />
                {coins < selectedBadge.threshold && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: 16,
                    }}
                  >
                    <IconLock size={32} color="#fff" />
                  </div>
                )}
              </div>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text
                  fw={700}
                  size="lg"
                  style={{ color: "var(--primary-color)" }}
                >
                  {selectedBadge.name}
                </Text>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.5 }}>
                  {selectedBadge.desc}
                </Text>
                <Badge
                  size="lg"
                  style={{
                    background: "var(--secondary-color)",
                    color: "#fff",
                    marginTop: 4,
                  }}
                >
                  Target: {selectedBadge.threshold.toLocaleString("id-ID")} koin
                </Badge>
              </Stack>
            </Group>

            <div
              style={{
                background: "#f9fafb",
                padding: 16,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
              }}
            >
              <Group
                justify="space-between"
                mb={selectedBadge.threshold > 0 ? 8 : 0}
              >
                <Text size="sm" fw={600} c="dark">
                  Progres Saat Ini
                </Text>
                {selectedBadge.threshold > 0 ? (
                  <Text
                    size="sm"
                    fw={700}
                    style={{ color: "var(--primary-color)" }}
                  >
                    {Math.min(coins, selectedBadge.threshold).toLocaleString(
                      "id-ID"
                    )}
                    {" / "}
                    {selectedBadge.threshold.toLocaleString("id-ID")}
                  </Text>
                ) : (
                  <Text size="sm" fw={600} c="var(--primary-color)">
                    Terbuka otomatis
                  </Text>
                )}
              </Group>
              {selectedBadge.threshold > 0 && (
                <Progress
                  value={Math.min(100, (coins / selectedBadge.threshold) * 100)}
                  radius="xl"
                  size="lg"
                  styles={{
                    root: {
                      background: "#e5e7eb",
                    },
                    section: {
                      background: "var(--primary-color)",
                    },
                  }}
                />
              )}
            </div>

            {coins >= selectedBadge.threshold ? (
              <Group
                gap="xs"
                style={{
                  background: "#d1fae5",
                  padding: 12,
                  borderRadius: 8,
                  border: "2px solid #10b981",
                }}
              >
                <IconTrophy size={24} color="#10b981" />
                <Text fw={600} c="#059669">
                  Selamat! Badge ini sudah kamu buka.
                </Text>
              </Group>
            ) : (
              <Group
                gap="xs"
                style={{
                  background: "#fef3c7",
                  padding: 12,
                  borderRadius: 8,
                  border: "2px solid #f59e0b",
                }}
              >
                <IconInfoCircle size={24} color="#f59e0b" />
                <Text fw={500} c="#d97706">
                  Kumpulkan{" "}
                  {(selectedBadge.threshold - coins).toLocaleString("id-ID")}{" "}
                  koin lagi untuk membuka badge ini!
                </Text>
              </Group>
            )}
          </Stack>
        )}
      </Modal>

      <style jsx>{`
        .coin-badge-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
        }

        .coin-badge-card:focus {
          outline: 3px solid var(--secondary-color);
          outline-offset: 4px;
        }
      `}</style>
    </>
  );
}

function AchievementsGrid({
  achievements,
  stats,
  coins,
}: {
  achievements: {
    achievement_key: string;
    coins_earned: number;
    earned_at: string;
  }[];
  stats: { xp: number; points: number; coursesCompleted: number };
  coins: number;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;
  const earnedKeys = new Set(achievements.map((a) => a.achievement_key));

  const totalPages = Math.ceil(ACHIEVEMENTS_CONFIG.length / itemsPerPage);
  const startIdx = currentPage * itemsPerPage;
  const currentItems = ACHIEVEMENTS_CONFIG.slice(
    startIdx,
    startIdx + itemsPerPage
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "coin":
        return "var(--secondary-color)"; // gold/yellow for coin badges
      case "course":
        return "#3b82f6"; // blue
      case "quiz":
        return "#8b5cf6"; // purple
      case "assignment":
        return "#f59e0b"; // amber
      case "discussion":
        return "#10b981"; // green
      case "activity":
        return "#ef4444"; // red
      case "project":
        return "#06b6d4"; // cyan
      case "rating":
        return "#ec4899"; // pink
      case "tier":
        return "#d97706"; // orange
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <Group justify="space-between" mb="md">
        <Text fw={600} size="lg">
          Semua Pencapaian ({achievements.length} / {ACHIEVEMENTS_CONFIG.length}
          )
        </Text>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {currentPage + 1} / {totalPages}
          </Text>
        </Group>
      </Group>

      {/* Navigation Arrows */}
      {currentPage > 0 && (
        <ActionIcon
          size="xl"
          variant="filled"
          color="var(--primary-color)"
          radius="xl"
          style={{
            position: "absolute",
            left: -20,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
        >
          <IconChevronLeft size={24} />
        </ActionIcon>
      )}

      {currentPage < totalPages - 1 && (
        <ActionIcon
          size="xl"
          variant="filled"
          color="var(--primary-color)"
          radius="xl"
          style={{
            position: "absolute",
            right: -20,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
        >
          <IconChevronRight size={24} />
        </ActionIcon>
      )}

      {/* Grid: 3 top, 2 bottom */}
      <div style={{ minHeight: 400 }}>
        {/* Top Row - 3 items */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mb="lg">
          {currentItems.slice(0, 3).map((config) => {
            // For coin-based achievements, unlock based on coins threshold
            const isUnlocked =
              config.category === "coin"
                ? coins >= config.coins
                : earnedKeys.has(config.key);
            const earned = achievements.find(
              (a) => a.achievement_key === config.key
            );

            return (
              <Card
                key={config.key}
                withBorder
                radius="lg"
                p="lg"
                style={{
                  background: isUnlocked
                    ? "linear-gradient(135deg, #fff 0%, #f8fafc 100%)"
                    : "#f1f5f9",
                  border: isUnlocked
                    ? `2px solid ${getCategoryColor(config.category)}`
                    : "2px solid #cbd5e1",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                className="achievement-card"
              >
                {/* Background pattern for unlocked */}
                {isUnlocked && (
                  <div
                    style={{
                      position: "absolute",
                      top: -20,
                      right: -20,
                      width: 100,
                      height: 100,
                      borderRadius: "50%",
                      background: `${getCategoryColor(config.category)}15`,
                      filter: "blur(20px)",
                    }}
                  />
                )}

                <Stack gap="md" style={{ position: "relative", zIndex: 1 }}>
                  {/* Coin Image */}
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: 120,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isUnlocked ? (
                      <NextImage
                        src={`/coins/${config.image}`}
                        alt={config.name}
                        width={100}
                        height={100}
                        style={{
                          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "relative",
                          width: 100,
                          height: 100,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <NextImage
                          src={`/coins/${config.image}`}
                          alt={config.name}
                          width={100}
                          height={100}
                          style={{
                            filter:
                              "grayscale(100%) brightness(0.7) opacity(0.4)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              background: "rgba(100, 116, 139, 0.9)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <IconLock size={24} color="white" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Achievement Info */}
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text
                        fw={700}
                        size="md"
                        c={
                          isUnlocked
                            ? getCategoryColor(config.category)
                            : "dimmed"
                        }
                        style={{ flex: 1, minWidth: 0 }}
                        lineClamp={1}
                      >
                        {config.name}
                      </Text>
                      <Badge
                        color={
                          isUnlocked
                            ? getCategoryColor(config.category)
                            : "gray"
                        }
                        variant={isUnlocked ? "filled" : "light"}
                        size="sm"
                      >
                        {config.coins} Koin
                      </Badge>
                    </Group>

                    <Text
                      size="sm"
                      c={isUnlocked ? "dark" : "dimmed"}
                      mb={8}
                      lineClamp={2}
                    >
                      {config.desc}
                    </Text>

                    {isUnlocked ? (
                      <Group gap={4}>
                        <IconCalendar size={14} color="#64748b" />
                        <Text size="xs" c="green" fw={600}>
                          Terbuka
                        </Text>
                      </Group>
                    ) : (
                      <Group gap={4}>
                        <IconLock size={14} color="#94a3b8" />
                        <Text size="xs" c="dimmed" fs="italic">
                          Belum terbuka
                        </Text>
                      </Group>
                    )}
                  </div>

                  {/* Category Badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                    }}
                  >
                    <Badge
                      size="xs"
                      variant="light"
                      color={getCategoryColor(config.category)}
                      style={{ textTransform: "capitalize" }}
                    >
                      {config.category}
                    </Badge>
                  </div>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>

        {/* Bottom Row - 2 items centered */}
        {currentItems.length > 3 && (
          <SimpleGrid
            cols={{ base: 1, sm: 2 }}
            spacing="lg"
            style={{
              maxWidth: currentItems.length === 4 ? "66%" : "100%",
              margin: "0 auto",
            }}
          >
            {currentItems.slice(3, 5).map((config) => {
              // For coin-based achievements, unlock based on coins threshold
              const isUnlocked =
                config.category === "coin"
                  ? coins >= config.coins
                  : earnedKeys.has(config.key);
              const earned = achievements.find(
                (a) => a.achievement_key === config.key
              );

              return (
                <Card
                  key={config.key}
                  withBorder
                  radius="lg"
                  p="lg"
                  style={{
                    background: isUnlocked
                      ? "linear-gradient(135deg, #fff 0%, #f8fafc 100%)"
                      : "#f1f5f9",
                    border: isUnlocked
                      ? `2px solid ${getCategoryColor(config.category)}`
                      : "2px solid #cbd5e1",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                  className="achievement-card"
                >
                  {/* Background pattern for unlocked */}
                  {isUnlocked && (
                    <div
                      style={{
                        position: "absolute",
                        top: -20,
                        right: -20,
                        width: 100,
                        height: 100,
                        borderRadius: "50%",
                        background: `${getCategoryColor(config.category)}15`,
                        filter: "blur(20px)",
                      }}
                    />
                  )}

                  <Stack gap="md" style={{ position: "relative", zIndex: 1 }}>
                    {/* Coin Image */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 120,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isUnlocked ? (
                        <NextImage
                          src={`/coins/${config.image}`}
                          alt={config.name}
                          width={100}
                          height={100}
                          style={{
                            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "relative",
                            width: 100,
                            height: 100,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <NextImage
                            src={`/coins/${config.image}`}
                            alt={config.name}
                            width={100}
                            height={100}
                            style={{
                              filter:
                                "grayscale(100%) brightness(0.7) opacity(0.4)",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                background: "rgba(100, 116, 139, 0.9)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconLock size={24} color="white" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Achievement Info */}
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text
                          fw={700}
                          size="md"
                          c={
                            isUnlocked
                              ? getCategoryColor(config.category)
                              : "dimmed"
                          }
                          style={{ flex: 1, minWidth: 0 }}
                          lineClamp={1}
                        >
                          {config.name}
                        </Text>
                        <Badge
                          color={
                            isUnlocked
                              ? getCategoryColor(config.category)
                              : "gray"
                          }
                          variant={isUnlocked ? "filled" : "light"}
                          size="sm"
                        >
                          {config.coins} Koin
                        </Badge>
                      </Group>

                      <Text
                        size="sm"
                        c={isUnlocked ? "dark" : "dimmed"}
                        mb={8}
                        lineClamp={2}
                      >
                        {config.desc}
                      </Text>

                      {isUnlocked ? (
                        <Group gap={4}>
                          <IconCalendar size={14} color="#64748b" />
                          <Text size="xs" c="green" fw={600}>
                            Terbuka
                          </Text>
                        </Group>
                      ) : (
                        <Group gap={4}>
                          <IconLock size={14} color="#94a3b8" />
                          <Text size="xs" c="dimmed" fs="italic">
                            Belum terbuka
                          </Text>
                        </Group>
                      )}
                    </div>

                    {/* Category Badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                      }}
                    >
                      <Badge
                        size="xs"
                        variant="light"
                        color={getCategoryColor(config.category)}
                        style={{ textTransform: "capitalize" }}
                      >
                        {config.category}
                      </Badge>
                    </div>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </div>

      {/* Page Indicators */}
      <Group justify="center" mt="lg" gap="xs">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: "none",
              background:
                i === currentPage ? "var(--primary-color)" : "#cbd5e1",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </Group>

      <style jsx>{`
        .achievement-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
        }
      `}</style>
    </div>
  );
}

function TierCarouselCard({
  stats,
}: {
  stats: { coins: number; points: number; coursesCompleted: number };
}) {
  const tiers = useMemo(
    () => [
      {
        key: "newbie",
        title: "Newbie",
        desc: "Pemula yang semangat",
        img: "/rewards/newbie.png",
        thresholds: { coins: 1000, points: 5000, courses: 4 },
        color: "#1e3a8a", // Biru tua
        gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
      },
      {
        key: "explorer",
        title: "Explorer",
        desc: "Penjelajah yang penasaran",
        img: "/rewards/explorer.png",
        thresholds: { coins: 10000, points: 20000, courses: 8 },
        color: "#059669", // Hijau Emerald
        gradient: "linear-gradient(135deg, #059669 0%, #fbbf24 100%)", // Emerald to Gold
      },
      {
        key: "scientist",
        title: "Scientist",
        desc: "Peneliti yang teliti",
        img: "/rewards/scientist.png",
        thresholds: { coins: 20000, points: 40000, courses: 12 },
        color: "#3b82f6", // Biru instead of white
        gradient: "linear-gradient(135deg, #f8fafc 0%, #3b82f6 100%)", // White to Blue
      },
      {
        key: "creative",
        title: "Creative",
        desc: "Kreator yang inovatif",
        img: "/rewards/creative.png",
        thresholds: { coins: 30000, points: 60000, courses: 20 },
        color: "#f97316", // Oranye
        gradient: "linear-gradient(135deg, #f97316 0%, #fbbf24 100%)", // Orange to Gold
      },
      {
        key: "futuristic",
        title: "Futuristic",
        desc: "Visionaris masa depan",
        img: "/rewards/futuristic.png",
        thresholds: { coins: 40000, points: 80000, courses: 32 },
        color: "#94a3b8", // Silver
        gradient: "linear-gradient(135deg, #94a3b8 0%, #06b6d4 100%)", // Silver to Neon Blue
      },
      {
        key: "hero",
        title: "Hero",
        desc: "Pahlawan sejati",
        img: "/rewards/hero.png",
        thresholds: { coins: 50000, points: 100000, courses: 40 },
        color: "#dc2626", // Merah
        gradient: "linear-gradient(135deg, #dc2626 0%, #ffffff 100%)", // Red to White
      },
      {
        key: "master",
        title: "Master",
        desc: "Master yang sempurna",
        img: "/rewards/master.png",
        thresholds: { coins: 60000, points: 120000, courses: 50 },
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
        stats.coins >= previousTier.thresholds.coins &&
        stats.points >= previousTier.thresholds.points &&
        stats.coursesCompleted >= previousTier.thresholds.courses
      );
    },
    [stats.coins, stats.points, stats.coursesCompleted, tiers]
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
                  {stats.coins.toLocaleString("id-ID")} /{" "}
                  {t.thresholds.coins.toLocaleString("id-ID")}
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
                      (stats.coins / t.thresholds.coins) * 100
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
