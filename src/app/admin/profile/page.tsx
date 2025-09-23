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
} from "@mantine/core";
import { useAuth } from "../../../hooks/useAuth";
import { IconUser, IconMail, IconPhone } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  // Error state
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [bioError, setBioError] = useState("");
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

  useEffect(() => {
    const savedProfile = localStorage.getItem("profile");
    const savedAvatar = localStorage.getItem("avatar");

    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      setFullName(profile.fullName || "");
      setUsername(profile.username || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setBio(profile.bio || "");
    } else if (user) {
      setFullName(user.fullName || "");
      setUsername(user.username || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setBio(user.bio || "");
    }

    if (savedAvatar) {
      setAvatar(savedAvatar);
    } else if (user?.avatar) {
      setAvatar(user.avatar);
    }
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

  async function getCropped(imageSrc: string, cropPixels: CroppedPixels) {
    const img = new Image();
    img.src = imageSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    const canvas = document.createElement("canvas");
    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageSrc;
    ctx.drawImage(
      img,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    );
    return canvas.toDataURL("image/png");
  }

  const applyCrop = async () => {
    if (rawImage && croppedAreaPixels) {
      const c = await getCropped(rawImage, croppedAreaPixels);
      setAvatar(c);
      localStorage.setItem("avatar", c);
    }
    setCropOpen(false);
  };

  const validateAll = () => {
    setFullNameError(fullName.trim() ? "" : "Nama lengkap wajib diisi");
    setUsernameError(
      username.trim()
        ? /\s/.test(username)
          ? "Tidak boleh ada spasi"
          : ""
        : "Username wajib diisi"
    );
    setEmailError(
      email.trim()
        ? email.includes("@")
          ? ""
          : "Format email tidak valid"
        : "Email wajib diisi"
    );
    setPhoneError(
      phone.trim()
        ? /^\d+$/.test(phone)
          ? ""
          : "Hanya angka"
        : "Nomor telepon wajib diisi"
    );
    setBioError(bio.trim() ? "" : "Bio wajib diisi");
  };

  const hasErrors = [
    fullNameError,
    usernameError,
    emailError,
    phoneError,
    bioError,
  ].some(Boolean);

  const handleSave = () => {
    validateAll();
    setTimeout(() => {
      const afterValidateErrors = [
        fullNameError,
        usernameError,
        emailError,
        phoneError,
        bioError,
      ].some(Boolean);
      if (afterValidateErrors) return;
      const profile = { fullName, username, email, phone, bio };
      localStorage.setItem("profile", JSON.stringify(profile));
      if (avatar) localStorage.setItem("avatar", avatar);
      setOpened(true);
    });
  };

  return (
    <>
      <Container size="lg">
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
                  <Avatar size={120} radius="xl" src={avatar}>
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
                      error={emailError}
                      onBlur={validateAll}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        setEmail(value);
                        if (emailError) setEmailError("");
                      }}
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
                    <TextInput
                      label="Bio"
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
                    disabled={hasErrors}
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
          <div style={{ position: "relative", width: "100%", height: 300 }}>
            <Cropper
              image={rawImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              rotation={0}
              minZoom={1}
              maxZoom={3}
              zoomSpeed={1}
              onRotationChange={() => {}}
              onCropSizeChange={() => {}}
              restrictPosition={true}
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
