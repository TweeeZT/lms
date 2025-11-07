"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Anchor,
  Container,
  Alert,
  Textarea,
  Grid,
  Select,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconUser,
  IconMail,
  IconLock,
  IconPhone,
} from "@tabler/icons-react";
import { SignupData } from "../../types";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";

// Schema validasi lengkap
const schema = z
  .object({
    email: z
      .string()
      .min(1, { message: "Email harus diisi" })
      .email({ message: "Email tidak valid" }),
    username: z
      .string()
      .min(3, { message: "Username minimal 3 karakter" })
      .regex(/^[a-zA-Z0-9_]+$/, {
        message: "Username hanya boleh huruf, angka, atau underscore",
      }),
    fullName: z
      .string()
      .min(2, { message: "Nama lengkap minimal 2 karakter" })
      .regex(/^[a-zA-Z\s]+$/, {
        message: "Nama lengkap hanya boleh huruf dan spasi",
      }),
    role: z.enum(["user", "school"]),
    phone: z
      .string()
      .min(10, { message: "Nomor telepon minimal 10 digit" })
      .regex(/^[0-9+]+$/, {
        message: "Nomor telepon hanya boleh angka atau tanda +",
      }),
    bio: z
      .string()
      .max(200, { message: "Bio maksimal 200 karakter" })
      .optional(),
    affiliateCode: z.string().optional(),
    password: z
      .string()
      .min(6, { message: "Password minimal 6 karakter" })
      .regex(/[A-Z]/, { message: "Password harus ada huruf besar" })
      .regex(/[0-9]/, { message: "Password harus ada angka" }),
    confirmPassword: z
      .string()
      .min(1, { message: "Konfirmasi password harus diisi" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password tidak sama",
  });

export function SignupForm() {
  const router = useRouter();
  const { signup, loading } = useAuth();
  const [signupError, setSignupError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SignupData & { confirmPassword: string; affiliateCode?: string }>(
    {
      defaultValues: {
        email: "",
        username: "",
        fullName: "",
        role: "user",
        phone: "",
        bio: "",
        affiliateCode: "",
        password: "",
        confirmPassword: "",
      },
      mode: "onSubmit", // ✅ validasi hanya saat submit
      reValidateMode: "onSubmit", // ✅ kalau sudah bener, error hilang
      shouldUnregister: true,
    }
  );

  useEffect(() => {
    reset({
      email: "",
      username: "",
      fullName: "",
      role: "user",
      phone: "",
      bio: "",
      affiliateCode: "",
      password: "",
      confirmPassword: "",
    });
  }, []);

  const onSubmit = async (
    data: SignupData & { confirmPassword: string; affiliateCode?: string }
  ) => {
    try {
      setSignupError(null);
      const result = await signup(data as SignupData);
      if (result.success) {
        reset(); // clear input setelah sukses
        router.push("/login");
      } else {
        setSignupError(result.error || "Pendaftaran gagal");
      }
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : "Pendaftaran gagal");
    }
  };

  return (
    <div className="min-h-screen w-full bg-white relative overflow-hidden flex items-center justify-center">
      {/* Soft Blue Radial Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "#ffffff",
          backgroundImage: `
            radial-gradient(circle at top center, rgba(59, 130, 246, 0.5), transparent 70%)
          `,
        }}
      />

      <Container size={650} className="relative z-10">
        <Paper
          m={20}
          shadow="xl"
          radius="lg"
          p={40}
          className="backdrop-blur-md bg-white/80 border border-gray-200"
        >
          <Title ta="center" className="text-2xl font-bold mb-2">
            Daftar Akun Baru
          </Title>
          <Text c="dimmed" size="sm" ta="center" mb={20}>
            Sudah punya akun?{" "}
            <Anchor size="sm" onClick={() => router.push("/login")}>
              Masuk di sini
            </Anchor>
          </Text>

          {signupError && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              color="red"
              mb="md"
              variant="light"
            >
              {signupError}
            </Alert>
          )}

          <form key="signup-form" onSubmit={handleSubmit(onSubmit)}>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Email"
                  placeholder="email@example.com"
                  leftSection={<IconMail size="1rem" />}
                  {...register("email")}
                  error={errors.email?.message}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Username"
                  placeholder="username_anda"
                  leftSection={<IconUser size="1rem" />}
                  {...register("username")}
                  error={errors.username?.message}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Nama Lengkap"
                  placeholder="Nama Lengkap Anda"
                  leftSection={<IconUser size="1rem" />}
                  {...register("fullName")}
                  error={errors.fullName?.message}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Peran"
                      placeholder="Pilih peran"
                      data={[
                        { value: "user", label: "Siswa" },
                        { value: "school", label: "Sekolah" },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.role?.message}
                    />
                  )}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 12 }}>
                <TextInput
                  label="Nomor Telepon"
                  placeholder="+62..."
                  leftSection={<IconPhone size="1rem" />}
                  {...register("phone")}
                  error={errors.phone?.message}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Textarea
                  label="Bio (opsional)"
                  placeholder="Ceritakan sedikit tentang kamu"
                  autosize
                  minRows={2}
                  maxRows={4}
                  {...register("bio")}
                  error={errors.bio?.message}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <TextInput
                  label="Kode Referral (opsional)"
                  placeholder="Masukkan kode referral jika ada"
                  {...register("affiliateCode")}
                  error={errors.affiliateCode?.message}
                  description="Dapatkan 1000 poin bonus untuk referrer jika menggunakan kode referral"
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <PasswordInput
                  label="Password"
                  placeholder="Password Anda"
                  leftSection={<IconLock size="1rem" />}
                  {...register("password")}
                  error={errors.password?.message}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <PasswordInput
                  label="Konfirmasi Password"
                  placeholder="Ulangi Password"
                  leftSection={<IconLock size="1rem" />}
                  {...register("confirmPassword")}
                  error={errors.confirmPassword?.message}
                />
              </Grid.Col>
            </Grid>

            <Button
              type="submit"
              fullWidth
              size="md"
              mt="xl"
              loading={loading}
              className="btn-primary"
            >
              Daftar Sekarang
            </Button>
          </form>
        </Paper>
      </Container>
    </div>
  );
}

export default function SignupPage() {
  return <SignupForm />;
}
