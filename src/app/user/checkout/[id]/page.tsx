"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../hooks/useAuth";
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Group,
  Skeleton,
  Stack,
  Image,
  Alert,
  Badge,
  Modal,
  Radio,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconTicket, IconDiscount } from "@tabler/icons-react";

export default function CheckoutCoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  interface CheckoutCourse {
    id: string;
    title: string;
    description: string;
    price: number | null;
    thumbnail?: string | null;
    category?: string | null;
    level?: string | null;
    totalModules?: number | null;
  }
  const [course, setCourse] = useState<CheckoutCourse | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Discount codes
  const [discountType, setDiscountType] = useState<
    "none" | "affiliate" | "voucher"
  >("none");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [validatingCode, setValidatingCode] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/user/courses/${id}/public`);
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat kursus");
        if (!active) return;
        setCourse(json.course);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat kursus");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const startPayment = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Check if free course
    const price = course?.price || 0;
    const baseAmount = price;
    const finalAmount = Math.max(0, baseAmount - discountAmount);

    if (finalAmount === 0 && baseAmount === 0) {
      // Handle free course - create transaction directly and enroll
      setCreatingInvoice(true);
      setInvoiceError(null);
      try {
        const res = await fetch("/api/user/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            courseId: id,
            isFree: true,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal mendaftar kursus gratis");
        }

        notifications.show({
          color: "green",
          title: "Berhasil!",
          message: "Anda berhasil terdaftar di kursus gratis ini",
        });

        // Redirect to success page
        router.push(`/success`);
      } catch (e) {
        setInvoiceError(
          e instanceof Error ? e.message : "Gagal mendaftar kursus"
        );
      } finally {
        setCreatingInvoice(false);
        setConfirmOpen(false);
      }
      return;
    }

    // Handle paid course with Xendit
    setCreatingInvoice(true);
    setInvoiceError(null);
    try {
      const res = await fetch("/api/user/checkout/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          courseId: id,
          affiliateCode:
            discountType === "affiliate" ? affiliateCode : undefined,
          voucherCode: discountType === "voucher" ? voucherCode : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal membuat invoice");
      if (json.invoiceUrl) {
        try {
          localStorage.setItem("pending_invoiceId", json.invoiceId || "");
          localStorage.setItem("pending_courseId", id);
        } catch {}
        window.location.href = json.invoiceUrl;
      } else {
        throw new Error("Invoice URL tidak tersedia");
      }
    } catch (e) {
      setInvoiceError(
        e instanceof Error ? e.message : "Gagal memulai pembayaran"
      );
    } finally {
      setCreatingInvoice(false);
      setConfirmOpen(false);
    }
  };

  // Helper function to translate level to Indonesian
  const getLevelIndonesia = (level: string | null | undefined) => {
    if (!level) return "";
    const levelMap: Record<string, string> = {
      beginner: "Pemula",
      intermediate: "Menengah",
      advanced: "Lanjutan",
    };
    return levelMap[level.toLowerCase()] || level;
  };

  // Helper function to translate category
  const getCategoryDisplay = (category: string | null | undefined) => {
    if (!category) return "";
    const categoryMap: Record<string, string> = {
      scratch: "Scratch",
      roblox: "Roblox",
    };
    return categoryMap[category.toLowerCase()] || category;
  };

  return (
    <Container size="md" py="lg" style={{ position: "relative" }}>
      {/* Back button */}
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={18} />}
        onClick={() => router.push("/user/explore")}
        mb="md"
        style={{ color: "var(--primary-color)" }}
      >
        Kembali ke Jelajahi Kursus
      </Button>
      {loading && (
        <Stack>
          <Skeleton height={220} radius="lg" />
          <Skeleton height={40} />
        </Stack>
      )}
      {!loading && error && (
        <Alert color="red" variant="light" mb="lg" title="Error">
          {error}
        </Alert>
      )}
      {!loading && course && (
        <Card
          withBorder
          radius="lg"
          padding="lg"
          style={{
            backdropFilter: "blur(6px)",
            background: "linear-gradient(135deg,#ffffffee,#f5f7fbf2)",
            boxShadow: "0 8px 30px rgba(30,55,105,0.12)",
          }}
        >
          <Stack gap="lg">
            {/* Top Section: Image + Info (responsive) */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 24,
                alignItems: "flex-start",
              }}
            >
              {/* Mobile stack: use CSS media query inline */}
              <style>{`
                @media (max-width: 768px) {
                  .checkout-flex { flex-direction: column; }
                  .checkout-thumb { width: 100% !important; }
                  .checkout-price-bar { display: flex !important; }
                }
              `}</style>
              <div
                className="checkout-flex"
                style={{ display: "flex", width: "100%", gap: 24 }}
              >
                <div
                  className="checkout-thumb"
                  style={{ width: 220, maxWidth: "100%", flexShrink: 0 }}
                >
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      radius="md"
                      h={180}
                      style={{ width: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 180,
                        borderRadius: 16,
                        background: "linear-gradient(135deg,#4dabf7,#1e3769)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 48,
                        color: "white",
                        fontWeight: 600,
                      }}
                    >
                      {course.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Title
                    order={3}
                    style={{ lineHeight: 1.15 }}
                    mb={4}
                    size="h2"
                  >
                    Checkout Kursus
                  </Title>
                  <Text fw={700} mt={4} size="lg" style={{ lineHeight: 1.3 }}>
                    {course.title}
                  </Text>
                  <Group gap={8} mt={8} wrap="wrap">
                    {course.category && (
                      <Badge
                        variant="light"
                        color={
                          course.category === "scratch" ? "orange" : "cyan"
                        }
                      >
                        {getCategoryDisplay(course.category)}
                      </Badge>
                    )}
                    {course.level && (
                      <Badge variant="outline" color="blue">
                        {getLevelIndonesia(course.level)}
                      </Badge>
                    )}
                    {typeof course.totalModules === "number" && (
                      <Badge variant="light" color="grape">
                        {course.totalModules} modul
                      </Badge>
                    )}
                  </Group>
                  <Text
                    size="sm"
                    c="dimmed"
                    mt="sm"
                    style={{ lineHeight: 1.55, wordBreak: "break-word" }}
                  >
                    {course.description}
                  </Text>

                  {/* Discount Code Section */}
                  <Card
                    withBorder
                    mt="md"
                    p="sm"
                    radius="md"
                    style={{ background: "#f8f9fa" }}
                  >
                    <Text size="sm" fw={600} mb="xs">
                      Kode Diskon (Opsional)
                    </Text>
                    <Radio.Group
                      value={discountType}
                      onChange={(val) => {
                        setDiscountType(
                          val as "none" | "affiliate" | "voucher"
                        );
                        setDiscountAmount(0);
                        setAffiliateCode("");
                        setVoucherCode("");
                      }}
                    >
                      <Stack gap="xs">
                        <Radio value="none" label="Tidak menggunakan kode" />
                        <Radio
                          value="affiliate"
                          label={
                            <Group gap={4}>
                              <IconDiscount size={16} />
                              <span>Kode Afiliasi (Diskon 10%)</span>
                            </Group>
                          }
                        />
                        <Radio
                          value="voucher"
                          label={
                            <Group gap={4}>
                              <IconTicket size={16} />
                              <span>Kode Voucher</span>
                            </Group>
                          }
                        />
                      </Stack>
                    </Radio.Group>

                    {discountType === "affiliate" && (
                      <Group mt="sm" align="flex-end">
                        <TextInput
                          style={{ flex: 1 }}
                          placeholder="Masukkan kode afiliasi"
                          value={affiliateCode}
                          onChange={(e) => {
                            setAffiliateCode(
                              e.currentTarget.value.toUpperCase()
                            );
                            setDiscountAmount(0);
                          }}
                          description="Dapatkan diskon 10% dan bantu referrer mendapat reward!"
                        />
                        <Button
                          onClick={async () => {
                            if (!affiliateCode.trim()) {
                              notifications.show({
                                color: "red",
                                message:
                                  "Masukkan kode afiliasi terlebih dahulu",
                              });
                              return;
                            }
                            setValidatingCode(true);
                            try {
                              const price = course?.price || 0;
                              const discount = price * 0.1;

                              const res = await fetch(
                                `/api/school/validate-code?code=${affiliateCode}&type=affiliate`
                              );
                              const json = await res.json();

                              if (json.success && json.valid) {
                                setDiscountAmount(discount);
                                notifications.show({
                                  color: "green",
                                  title: "Kode Valid!",
                                  message: `Diskon 10% (Rp ${discount.toLocaleString()}) akan diterapkan`,
                                });
                              } else {
                                setDiscountAmount(0);
                                notifications.show({
                                  color: "red",
                                  message:
                                    json.error || "Kode afiliasi tidak valid",
                                });
                              }
                            } catch (e) {
                              notifications.show({
                                color: "red",
                                message: "Gagal memvalidasi kode",
                              });
                            } finally {
                              setValidatingCode(false);
                            }
                          }}
                          loading={validatingCode}
                          style={{ backgroundColor: "rgb(30, 55, 105)" }}
                        >
                          Terapkan
                        </Button>
                      </Group>
                    )}

                    {discountType === "voucher" && (
                      <Group mt="sm" align="flex-end">
                        <TextInput
                          style={{ flex: 1 }}
                          placeholder="Masukkan kode voucher"
                          value={voucherCode}
                          onChange={(e) => {
                            setVoucherCode(e.currentTarget.value.toUpperCase());
                            setDiscountAmount(0);
                          }}
                          description="Masukkan kode voucher untuk mendapat diskon"
                        />
                        <Button
                          onClick={async () => {
                            if (!voucherCode.trim()) {
                              notifications.show({
                                color: "red",
                                message:
                                  "Masukkan kode voucher terlebih dahulu",
                              });
                              return;
                            }
                            setValidatingCode(true);
                            try {
                              const res = await fetch(
                                `/api/school/validate-code?code=${voucherCode}&type=voucher`
                              );
                              const json = await res.json();

                              if (json.success && json.valid) {
                                const price = course?.price || 0;

                                let discount = 0;
                                if (json.discountType === "percentage") {
                                  discount = price * (json.discountValue / 100);
                                } else if (json.discountType === "fixed") {
                                  discount = json.discountValue;
                                }

                                setDiscountAmount(discount);
                                notifications.show({
                                  color: "green",
                                  title: "Kode Valid!",
                                  message: `Diskon Rp ${discount.toLocaleString()} akan diterapkan`,
                                });
                              } else {
                                setDiscountAmount(0);
                                notifications.show({
                                  color: "red",
                                  message:
                                    json.error || "Kode voucher tidak valid",
                                });
                              }
                            } catch (e) {
                              notifications.show({
                                color: "red",
                                message: "Gagal memvalidasi kode",
                              });
                            } finally {
                              setValidatingCode(false);
                            }
                          }}
                          loading={validatingCode}
                          style={{ backgroundColor: "rgb(30, 55, 105)" }}
                        >
                          Terapkan
                        </Button>
                      </Group>
                    )}

                    {discountAmount > 0 && (
                      <Alert mt="sm" color="green" variant="light">
                        <Text size="sm">
                          Diskon: <b>Rp {discountAmount.toLocaleString()}</b>
                        </Text>
                      </Alert>
                    )}
                  </Card>

                  <Alert
                    mt="md"
                    color="yellow"
                    variant="light"
                    title="Perhatian"
                    radius="md"
                    style={{ fontSize: 13, lineHeight: 1.5 }}
                  >
                    Klik <b>Bayar Sekarang</b> untuk membuka halaman pembayaran.
                    Setelah <b>pembayaran berhasil</b>, Anda akan otomatis
                    terdaftar dan diarahkan ke halaman sukses.
                  </Alert>
                  {invoiceError && (
                    <Alert
                      mt="sm"
                      color="red"
                      variant="light"
                      title="Pembayaran"
                      radius="md"
                      style={{ fontSize: 13 }}
                    >
                      {invoiceError}
                    </Alert>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Price + Button */}
            <Group
              justify="space-between"
              align="center"
              mt="sm"
              style={{ display: "flex" }}
              className="checkout-desktop-bar"
            >
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Total Pembayaran
                </Text>
                {discountAmount > 0 && (
                  <Text size="sm" c="dimmed" td="line-through">
                    Rp {(course?.price || 0).toLocaleString()}
                  </Text>
                )}
                <Text
                  fw={800}
                  size="xl"
                  c="green"
                  style={{ letterSpacing: 0.5 }}
                >
                  {Math.max(0, (course?.price || 0) - discountAmount) === 0 &&
                  (course?.price || 0) === 0
                    ? "GRATIS"
                    : `Rp ${Math.max(
                        0,
                        (course?.price || 0) - discountAmount
                      ).toLocaleString()}`}
                </Text>
                {discountAmount > 0 && (
                  <Text size="xs" c="green" fw={600} mt={2}>
                    Hemat Rp {discountAmount.toLocaleString()}
                  </Text>
                )}
              </div>
              <Button
                className="btn-primary"
                loading={creatingInvoice}
                onClick={() => setConfirmOpen(true)}
                size="md"
                radius="md"
                style={{ minWidth: 180 }}
              >
                {Math.max(0, (course?.price || 0) - discountAmount) === 0 &&
                (course?.price || 0) === 0
                  ? "Daftar Sekarang"
                  : "Bayar Sekarang"}
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={
          <Text fw={700} size="lg">
            Konfirmasi{" "}
            {Math.max(0, (course?.price || 0) - discountAmount) === 0 &&
            (course?.price || 0) === 0
              ? "Pendaftaran"
              : "Pembayaran"}
          </Text>
        }
        centered
      >
        <Stack gap="md">
          <Text>
            {Math.max(0, (course?.price || 0) - discountAmount) === 0 &&
            (course?.price || 0) === 0
              ? "Anda akan terdaftar di kursus gratis ini. Lanjutkan?"
              : `Anda akan diarahkan ke halaman pembayaran untuk menyelesaikan transaksi sebesar Rp ${Math.max(
                  0,
                  (course?.price || 0) - discountAmount
                ).toLocaleString()}${
                  discountAmount > 0
                    ? ` (Diskon Rp ${discountAmount.toLocaleString()} telah diterapkan)`
                    : ""
                }. Lanjutkan?`}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setConfirmOpen(false)}
              disabled={creatingInvoice}
            >
              Batal
            </Button>
            <Button
              className="btn-primary"
              onClick={startPayment}
              loading={creatingInvoice}
            >
              {Math.max(0, (course?.price || 0) - discountAmount) === 0 &&
              (course?.price || 0) === 0
                ? "Ya, Daftar"
                : "Ya, Bayar"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
