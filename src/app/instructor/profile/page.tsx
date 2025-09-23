"use client";

import { useState, useEffect, useMemo } from "react";
import { notifications } from "@mantine/notifications";
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
  Paper,
  Divider,
  Badge,
} from "@mantine/core";
import { Modal, Slider } from "@mantine/core";
import { useAuth } from "../../../hooks/useAuth";
import { IconUser, IconMail, IconPhone } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";

export default function InstructorProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [rawAvatarFile, setRawAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<{
    x: number;
    y: number;
    zoom: number;
  }>({ x: 0, y: 0, zoom: 1 });
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const debounced = <Args extends unknown[]>(
    fn: (...args: Args) => void | Promise<void>,
    ms = 400
  ) => {
    let t: ReturnType<typeof setTimeout> | undefined;
    return (...args: Args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    phone?: string;
  }>({});

  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem("instructorProfile");
      const cachedAvatar = localStorage.getItem("instructorAvatar");
      if (cached) {
        try {
          const p = JSON.parse(cached);
          setFullName(p.fullName || "");
          setUsername(p.username || "");
          setEmail(p.email || "");
          setPhone(p.phone || "");
          setBio(p.bio || "");
        } catch {}
      }
      if (cachedAvatar) setAvatar(cachedAvatar);

      if (!user) return;
      try {
        const res = await fetch(
          `/api/instructor/profile?${new URLSearchParams({
            instructorId: user.id,
          })}`
        );
        const json = await res.json();
        if (res.ok && json.success) {
          const u = json.user;
          setFullName(u.full_name || "");
          setUsername(u.username || "");
          setEmail(u.email || "");
          setPhone(u.phone || "");
          setBio(u.bio || "");
          setAvatar(u.avatar || "");
          if (json.instructor)
            setBankAccount(json.instructor.bank_account || "");
        }
      } catch {}
    };
    load();
  }, [user]);
  // Do not early-return to keep hooks order consistent; page will still render but actions are no-ops until user exists

  // Choose avatar: only preview & crop; upload on Save
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setRawAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarCrop({ x: 0, y: 0, zoom: 1 });
    setCropModalOpen(true);
  };

  // 1:1 crop with canvas (center with pan/zoom)
  const getCroppedBlob = async (): Promise<Blob | null> => {
    if (!rawAvatarFile || !avatarPreview || !croppedAreaPixels) return null;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = avatarPreview;
    });
    const canvas = document.createElement("canvas");
    const out = 512;
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    const { x, y, width, height } = croppedAreaPixels;
    ctx.drawImage(image, x, y, width, height, 0, 0, out, out);
    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
  };

  // realtime validation handlers
  const validateUsername = useMemo(
    () =>
      debounced(async (name: string) => {
        if (!name) {
          setFieldErrors((e) => ({ ...e, username: undefined }));
          return;
        }
        try {
          const res = await fetch(
            `/api/instructor/profile/validate?username=${encodeURIComponent(
              name
            )}&excludeId=${encodeURIComponent(user?.id || "")}`
          );
          const json = await res.json();
          setFieldErrors((e) => ({
            ...e,
            username: json.valid
              ? undefined
              : json.error || "Username tidak valid",
          }));
        } catch {
          setFieldErrors((e) => ({ ...e, username: "Gagal validasi" }));
        }
      }, 400),
    [user?.id]
  );

  const validatePhone = useMemo(
    () =>
      debounced(async (p: string) => {
        if (!p) {
          setFieldErrors((e) => ({ ...e, phone: undefined }));
          return;
        }
        try {
          const res = await fetch(
            `/api/instructor/profile/validate?phone=${encodeURIComponent(
              p
            )}&excludeId=${encodeURIComponent(user?.id || "")}`
          );
          const json = await res.json();
          setFieldErrors((e) => ({
            ...e,
            phone: json.valid ? undefined : json.error || "Telepon tidak valid",
          }));
        } catch {
          setFieldErrors((e) => ({ ...e, phone: "Gagal validasi" }));
        }
      }, 400),
    [user?.id]
  );

  const handleSave = async () => {
    if (!user) return;
    // validations
    const errs: typeof fieldErrors = {};
    if (!/^[A-Za-z0-9_.-]+$/.test(username)) {
      errs.username = "Username hanya huruf/angka/._- (tanpa spasi)";
    }
    if (phone && !/^\+?\d{6,15}$/.test(phone)) {
      errs.phone = "Nomor telepon harus angka (boleh awali +)";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      notifications.show({
        color: "red",
        message: "Periksa input yang tidak valid",
      });
      return;
    }

    setSaving(true);
    try {
      let finalAvatarUrl = avatar;
      if (rawAvatarFile) {
        const blob = await getCroppedBlob();
        if (blob) {
          const form = new FormData();
          form.append(
            "file",
            blob,
            rawAvatarFile.name.replace(/\.[^.]+$/, ".jpg")
          );
          form.append("userId", user.id);
          form.append("filename", rawAvatarFile.name);
          form.append("updateProfile", "0");
          const up = await fetch("/api/instructor/profile/avatar", {
            method: "POST",
            body: form,
          });
          const uj = await up.json();
          if (up.ok && uj.success) {
            finalAvatarUrl = uj.url as string;
          } else {
            throw new Error(uj.error || "Gagal upload avatar");
          }
        }
      }

      const res = await fetch("/api/instructor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: user.id,
          fullName,
          username,
          phone,
          bio,
          avatarUrl: finalAvatarUrl,
          bankAccount,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          color: "green",
          message: "Profil berhasil disimpan",
        });
        setAvatar(finalAvatarUrl || "");
        setRawAvatarFile(null);
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
        updateUser({ fullName, username, avatar: finalAvatarUrl });
        localStorage.setItem(
          "instructorProfile",
          JSON.stringify({ fullName, username, email, phone, bio })
        );
        if (finalAvatarUrl)
          localStorage.setItem("instructorAvatar", finalAvatarUrl);
      } else {
        notifications.show({
          color: "red",
          message: json.error || "Gagal menyimpan profil",
        });
      }
    } catch {
      notifications.show({ color: "red", message: "Gagal menyimpan profil" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>Profil Instruktur</Title>
          <Text c="dimmed">Kelola informasi akun Anda</Text>
        </div>

        <Grid gutter="lg">
          {/* Kartu avatar */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card padding="lg" radius="md" withBorder>
              <Stack align="center" gap="md">
                <Avatar size={120} radius="xl" src={avatarPreview || avatar}>
                  {fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </Avatar>

                <Button variant="light" component="label" size="xs">
                  Upload Foto
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarUpload}
                  />
                </Button>

                {avatarPreview && (
                  <Text size="sm" c="dimmed">
                    Klik &quot;Upload Foto&quot; lalu atur crop di modal
                  </Text>
                )}

                <Stack gap={4} align="center">
                  <Text fw={700}>{fullName}</Text>
                  <Badge color="blue" variant="light">
                    Instruktur
                  </Badge>
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Form profil */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Informasi Akun
              </Title>
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Nama Lengkap"
                    leftSection={<IconUser size={16} />}
                    value={fullName}
                    onChange={(e) => setFullName(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Username"
                    value={username}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setUsername(v);
                      validateUsername(v);
                    }}
                    error={fieldErrors.username}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    c="black"
                    disabled
                    label="Email"
                    leftSection={<IconMail size={16} />}
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Telepon"
                    leftSection={<IconPhone size={16} />}
                    value={phone}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setPhone(v);
                      validatePhone(v);
                    }}
                    error={fieldErrors.phone}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <TextInput
                    disabled
                    label="Rekening Bank"
                    placeholder="Mis. BCA-1234567890"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <div style={{ width: "100%" }}>
                    <Text size="sm" mb={6} fw={500}>
                      Bio
                    </Text>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.currentTarget.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid var(--mantine-color-gray-4)",
                        fontFamily: "inherit",
                        fontSize: 14,
                        resize: "vertical",
                      }}
                      placeholder="Ceritakan tentang pengalaman mengajar, spesialisasi, dsb."
                    />
                  </div>
                </Grid.Col>
              </Grid>

              <Divider my="md" />
              <Group justify="end">
                <Button
                  variant="light"
                  type="button"
                  onClick={() => router.back()}
                >
                  Kembali
                </Button>
                <Button
                  className="btn-primary"
                  onClick={handleSave}
                  loading={saving}
                >
                  Simpan Perubahan
                </Button>
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Crop Modal */}
        <Modal
          opened={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          title="Atur Crop Foto"
          size="lg"
          centered
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 360,
              background: "#111",
            }}
          >
            {avatarPreview && (
              <Cropper
                image={avatarPreview}
                crop={{ x: avatarCrop.x, y: avatarCrop.y }}
                zoom={avatarCrop.zoom}
                aspect={1}
                onCropChange={(c) =>
                  setAvatarCrop((prev) => ({ ...prev, ...c }))
                }
                onZoomChange={(z) =>
                  setAvatarCrop((prev) => ({ ...prev, zoom: z }))
                }
                onCropComplete={(_, cropped) => setCroppedAreaPixels(cropped)}
              />
            )}
          </div>
          <Stack mt="md">
            <Group>
              <Text size="sm" c="dimmed">
                Zoom
              </Text>
              <Slider
                min={1}
                max={3}
                step={0.01}
                value={avatarCrop.zoom}
                onChange={(z) => setAvatarCrop((p) => ({ ...p, zoom: z }))}
                style={{ flex: 1 }}
              />
            </Group>
            <Group justify="end">
              <Button variant="light" onClick={() => setCropModalOpen(false)}>
                Batal
              </Button>
              <Button
                className="btn-primary"
                onClick={() => setCropModalOpen(false)}
              >
                Selesai
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
