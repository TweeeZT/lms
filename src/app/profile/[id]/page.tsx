import { Avatar, Badge, Button, Card, Container, Group, Stack, Text, TextInput, Textarea, Title, SimpleGrid } from "@mantine/core";
import { notFound } from "next/navigation";
import supabaseAdmin from "../../../lib/supabaseServer";
import { IconArrowLeft } from "@tabler/icons-react";

type Profile = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  phone: string | null;
  bio: string | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string };
}) {
  const id = params.id;
  if (!id) notFound();

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
    )
    .eq("id", id)
    .single<Profile>();

  if (error || !data) {
    notFound();
  }

  const user = data;

  const returnTo = (searchParams?.from && decodeURIComponent(searchParams.from)) || "/user/discussions";

  return (
    <Container size="xl" py="xl" style={{ position: "relative", zIndex: 1 }}>
      {/* Header back button */}
      <Group justify="space-between" mb="xl">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="white"
          color="dark"
          component="a"
          href={returnTo}
          size="md"
          radius="xl"
          style={{ fontWeight: 500, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
        >
          Kembali ke Diskusi
        </Button>
      </Group>
      {/* Profile summary header (mirrors edit profile styling, without actions) */}
      <Card radius="xl" p="xl" mb="xl" withBorder style={{ background: "var(--primary-color)" }}>
  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <Stack align="center">
            <Avatar
              size={110}
              radius="xl"
              src={user.avatar || undefined}
              style={{ border: "4px solid var(--primary-color)" }}
            >
              {(user.full_name || user.username || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </Avatar>
          </Stack>
          <div style={{ flex: 1 }}>
            <Stack gap={6} align="center" style={{ textAlign: "center" }}>
              {user.role && (
                <Badge bg="var(--secondary-color)" variant="filled" radius="xl" c="var(--primary-color)" w="fit-content" mx="auto">
                  {user.role}
                </Badge>
              )}
              <Title order={2} c="white" ta="center">
                {user.full_name || user.username || "Pengguna"}
              </Title>
              <Text c="white" opacity={0.9} size="sm" ta="center">
                {user.email}
              </Text>
            </Stack>
          </div>
        </SimpleGrid>
      </Card>

      {/* Read-only profile details */}
      <Card radius="xl" p="xl" withBorder style={{ background: "var(--card-bg)" }}>
        <Stack gap="xl">
          <Title order={3} c="var(--primary-color)">Profil</Title>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <div>
              <Text fw={600} size="sm" c="dimmed">Nama Lengkap</Text>
              <TextInput value={user.full_name || "-"} readOnly radius="md" size="md" />
            </div>
            <div>
              <Text fw={600} size="sm" c="dimmed">Username</Text>
              <TextInput value={user.username || "-"} readOnly radius="md" size="md" />
            </div>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <div>
              <Text fw={600} size="sm" c="dimmed">Email</Text>
              <TextInput value={user.email || "-"} readOnly radius="md" size="md" />
            </div>
            <div>
              <Text fw={600} size="sm" c="dimmed">Telepon</Text>
              <TextInput value={user.phone || "-"} readOnly radius="md" size="md" />
            </div>
          </SimpleGrid>

          <div>
            <Text fw={600} size="sm" c="dimmed">Bio</Text>
            <Textarea value={user.bio || "-"} readOnly rows={4} radius="md" size="md" />
          </div>
        </Stack>
      </Card>
    </Container>
  );
}
