"use client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Title,
  Paper,
  TextInput,
  Textarea,
  Button,
  Avatar,
  Group,
  Text,
  Loader,
} from "@mantine/core";
import { IconUser, IconMail, IconPhone, IconSchool } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

export default function SchoolProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setBio(user.bio || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          fullName,
          phone,
          bio,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        updateUser({ fullName, phone, bio });
        notifications.show({
          color: "green",
          title: "Berhasil",
          message: "Profil berhasil diperbarui",
        });
      } else {
        notifications.show({
          color: "red",
          title: "Error",
          message: json.error || "Gagal memperbarui profil",
        });
      }
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Box
        p="lg"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Loader size="lg" />
      </Box>
    );
  }

  return (
    <Box p="lg">
      <Title order={2} mb="xl" style={{ color: "var(--primary-color)" }}>
        Profil Sekolah
      </Title>

      <Paper withBorder p="xl" radius="lg" mb="lg">
        <Group mb="xl">
          <Avatar size={80} radius="xl" color="blue">
            <IconSchool size={40} />
          </Avatar>
          <div>
            <Text size="xl" fw={700}>
              {user.fullName}
            </Text>
            <Text c="dimmed" size="sm">
              {user.email}
            </Text>
          </div>
        </Group>

        <TextInput
          label="Nama Sekolah"
          placeholder="Nama lengkap sekolah"
          value={fullName}
          onChange={(e) => setFullName(e.currentTarget.value)}
          mb="md"
          leftSection={<IconUser size={18} />}
        />

        <TextInput
          label="Email"
          placeholder="Email sekolah"
          value={email}
          disabled
          mb="md"
          leftSection={<IconMail size={18} />}
        />

        <TextInput
          label="Nomor Telepon"
          placeholder="Nomor telepon sekolah"
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
          mb="md"
          leftSection={<IconPhone size={18} />}
        />

        <Textarea
          label="Bio"
          placeholder="Deskripsi singkat tentang sekolah"
          value={bio}
          onChange={(e) => setBio(e.currentTarget.value)}
          minRows={4}
          mb="xl"
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => router.back()}>
            Batal
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            style={{ background: "var(--primary-color)" }}
          >
            Simpan Perubahan
          </Button>
        </Group>
      </Paper>
    </Box>
  );
}
