"use client";

import { useState, useEffect } from "react";
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
  Modal,
  LoadingOverlay,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../../hooks/useAuth";
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [saving, setSaving] = useState(false);

  // Error state
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [bioError, setBioError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [opened, setOpened] = useState(false);
  // image cropping states
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  interface CroppedPixels {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedPixels | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageError, setImageError] = useState("");

  // role dinamis (default: Admin)
  const role = user?.role || "Admin";

  // warna badge berdasarkan role
  const badgeColor: "red" | "blue" = role === "Admin" ? "red" : "blue";

  // Load fresh profile from Supabase users table (single fetch) - email is immutable here
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoadingFetch(true);
        // Use existing user object as primary source (server already synced). If needed could refetch via /api/admin/users list, but endpoint excludes actor, so rely on auth context.
        setFullName(user.fullName || "");
        setUsername(user.username || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setBio(user.bio || "");
        setAvatar(user.avatar || "");
      } finally {
        setLoadingFetch(false);
      }
    })();
  }, [user]);

  if (!user) return null;

  // Upload avatar -> open cropper
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("File harus gambar");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageError("Maksimal 3MB");
      return;
    }
    setImageError("");
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = (_: unknown, pixels: CroppedPixels) =>
    setCroppedAreaPixels(pixels);

  const applyCrop = async () => {
    if (rawImage && croppedAreaPixels) {
      // Enforce 1024x1024 output
      const img = new Image();
      img.src = rawImage;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          img,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          size,
          size
        );
        const dataUrl = canvas.toDataURL("image/png");
        setAvatar(dataUrl);
      }
    }
    setCropOpen(false);
  };

  const validateAll = async () => {
    setFullNameError(fullName.trim() ? "" : "Nama lengkap wajib diisi");
    // Username: wajib, tanpa spasi, minimal 4 karakter, unik
    if (!username.trim()) {
      setUsernameError("Username wajib diisi");
    } else if (/\s/.test(username)) {
      setUsernameError("Tidak boleh ada spasi");
    } else if (username.length < 4) {
      setUsernameError("Minimal 4 karakter");
    } else {
      setUsernameError("");
      setCheckingUsername(true);
      // Cek unik username ke server (kecuali username sendiri)
      try {
        const res = await fetch(`/api/users/check?username=${encodeURIComponent(username.trim())}`);
        const json = await res.json();
        if (res.ok && json.success && json.found && json.user?.id !== user?.id) {
          setUsernameError("Username sudah digunakan");
        }
      } catch {}
      setCheckingUsername(false);
    }
    setEmailError(
      email.trim()
        ? email.includes("@")
          ? ""
          : "Format email tidak valid"
        : "Email wajib diisi"
    );
    // Telepon: wajib, boleh diawali +, hanya angka setelah +, minimal 10 digit (tanpa +)
    if (!phone.trim()) {
      setPhoneError("Nomor telepon wajib diisi");
    } else if (!/^\+?\d+$/.test(phone)) {
      setPhoneError("Hanya angka, boleh diawali +");
    } else if (phone.replace(/^\+/, "").length < 10) {
      setPhoneError("Minimal 10 digit");
    } else {
      setPhoneError("");
    }
    // Bio: boleh kosong, jika diisi minimal 10 karakter
    if (bio.trim() && bio.trim().length < 10) {
      setBioError("Minimal 10 karakter jika diisi");
    } else {
      setBioError("");
    }
  };

  const hasErrors = [
    fullNameError,
    usernameError,
    emailError,
    phoneError,
    bioError,
    checkingUsername,
  ].some(Boolean);

  const handleSave = async () => {
    await validateAll();
    const afterValidateErrors = [
      fullNameError,
      usernameError,
      emailError,
      phoneError,
      bioError,
      checkingUsername,
    ].some(Boolean);
    if (afterValidateErrors) return;
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: user.id,
        full_name: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
      };
      // If avatar is base64 data url (not already a hosted https URL) send as avatar_base64
      if (avatar && avatar.startsWith("data:image/")) {
        payload.avatar_base64 = avatar;
      }

      const res = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan profil");
      }
      // Update local auth context
      updateUser({
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        avatar: json.item?.avatar_url || avatar,
      });
      setAvatar(json.item?.avatar_url || avatar);
      notifications.show({
        title: "Profil disimpan",
        message: "Perubahan berhasil disimpan.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (e) {
      notifications.show({
        title: "Gagal",
        message: e instanceof Error ? e.message : "Terjadi kesalahan",
        color: "red",
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Container size="lg" style={{ position: "relative" }}>
        <LoadingOverlay visible={loadingFetch || saving} zIndex={100} />
        <Modal
          opened={opened}
          onClose={() => setOpened(false)}
          title="Berhasil"
          centered
        >
          <Text size="sm">Profil berhasil disimpan ke penyimpanan lokal.</Text>
          <Group justify="end" mt="md">
            <Button size="xs" onClick={() => setOpened(false)}>
              Tutup
            </Button>
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setOpened(false);
                router.push("/admin/dashboard");
              }}
            >
              Ke Dashboard
            </Button>
          </Group>
        </Modal>
        <Stack gap="lg">
          <div>
            <Title order={2}>Profil {role}</Title>
            <Text c="dimmed">Kelola informasi akun Anda</Text>
          </div>

          <Grid gutter="lg">
            {/* Avatar Card */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card padding="lg" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <Avatar
                    size={120}
                    radius={0}
                    src={avatar}
                    style={{ borderRadius: 12, overflow: "hidden" }}
                  >
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
                  {imageError && (
                    <Text size="xs" c="red">
                      {imageError}
                    </Text>
                  )}

                  <Stack gap={4} align="center">
                    <Text fw={700}>{fullName}</Text>
                    <Badge color={badgeColor} variant="light">
                      {role}
                    </Badge>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Form Data */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Paper p="lg" radius="md" withBorder>
                <Title order={4} mb="md">
                  Informasi Akun
                </Title>
                <Grid gutter="md">
                  {/* Nama Lengkap */}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Nama Lengkap"
                      leftSection={<IconUser size={16} />}
                      value={fullName}
                      error={fullNameError}
                      onBlur={validateAll}
                      onChange={(e) => {
                        setFullName(e.currentTarget.value);
                        if (fullNameError) setFullNameError("");
                      }}
                    />
                  </Grid.Col>

                  {/* Username */}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Username"
                      value={username}
                      error={usernameError}
                      onBlur={validateAll}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        setUsername(value);
                        if (usernameError) setUsernameError("");
                      }}
                    />
                  </Grid.Col>

                  {/* Email */}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Email"
                      leftSection={<IconMail size={16} />}
                      value={email}
                      disabled
                      description="Email tidak dapat diubah"
                    />
                  </Grid.Col>

                  {/* Telepon */}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Telepon"
                      placeholder="Contoh: 081234567890"
                      leftSection={<IconPhone size={16} />}
                      value={phone}
                      error={phoneError}
                      onBlur={validateAll}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        if (/^\d*$/.test(value)) {
                          setPhone(value);
                          if (phoneError) setPhoneError("");
                        }
                      }}
                    />
                  </Grid.Col>

                  {/* Bio */}
                  <Grid.Col span={12}>
                    <Textarea
                      label="Bio"
                      minRows={4}
                      autosize
                      value={bio}
                      error={bioError}
                      onBlur={validateAll}
                      onChange={(e) => {
                        setBio(e.currentTarget.value);
                        if (bioError) setBioError("");
                      }}
                    />
                  </Grid.Col>
                </Grid>

                <Divider my="md" />
                <Group justify="end">
                  <Button
                    variant="light"
                    onClick={() => router.push("/admin/dashboard")}
                  >
                    Kembali
                  </Button>
                  <Button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={hasErrors || saving}
                    loading={saving}
                  >
                    Simpan Perubahan
                  </Button>
                </Group>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
      <Modal
        opened={cropOpen}
        onClose={() => setCropOpen(false)}
        title="Crop Avatar"
        size="lg"
        centered
      >
        {rawImage && (
          <div style={{ position: "relative", width: "100%", height: 360 }}>
            <Cropper
              image={rawImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect" // square crop
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              rotation={0}
              minZoom={1}
              maxZoom={3}
              zoomSpeed={1}
              restrictPosition
              style={{ containerStyle: { width: "100%", height: "100%" } }}
              classes={{}}
              mediaProps={{}}
              cropperProps={{}}
              keyboardStep={1}
            />
          </div>
        )}
        <Group mt="md" justify="space-between">
          <Group gap="xs">
            <Button
              variant="default"
              onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
            >
              - Zoom
            </Button>
            <Button
              variant="default"
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            >
              + Zoom
            </Button>
          </Group>
          <Group gap="xs">
            <Button variant="subtle" onClick={() => setCropOpen(false)}>
              Batal
            </Button>
            <Button onClick={applyCrop}>Simpan</Button>
          </Group>
        </Group>
      </Modal>
    </>
  );
}
