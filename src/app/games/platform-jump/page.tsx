"use client";

import { useEffect, useRef, useState } from "react";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
} from "@mantine/core";
import { useAuth } from "../../../hooks/useAuth";
import { notifications } from "@mantine/notifications";
import { IconTrophy, IconRefresh, IconArrowLeft } from "@tabler/icons-react";

export default function PlatformJumpGame() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const gameLoopRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Game variables
    const playerX = 100;
    let playerY = canvas.height - 150;
    let velocityY = 0;
    let isJumping = false;
    const playerWidth = 40;
    const playerHeight = 50;
    const gravity = 0.6;
    const jumpStrength = -12;
    const groundY = canvas.height - 100;

    let scrollSpeed = 4;
    const obstacles: { x: number; y: number; width: number; height: number }[] =
      [];
    let frameCount = 0;
    let currentScore = 0;

    // Handle keyboard
    const keys: { [key: string]: boolean } = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isJumping) {
        velocityY = jumpStrength;
        isJumping = true;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Game loop
    const gameLoop = () => {
      if (!ctx || !canvas) return;

      // Clear canvas
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#87ceeb");
      gradient.addColorStop(1, "#f0e68c");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw ground
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

      // Draw grass
      ctx.fillStyle = "#228b22";
      ctx.fillRect(0, groundY - 5, canvas.width, 5);

      // Apply gravity
      velocityY += gravity;
      playerY += velocityY;

      // Ground collision
      if (playerY >= groundY - playerHeight) {
        playerY = groundY - playerHeight;
        velocityY = 0;
        isJumping = false;
      }

      // Draw player (stick figure style)
      ctx.fillStyle = "#ff6b6b";
      // Head
      ctx.beginPath();
      ctx.arc(playerX + playerWidth / 2, playerY + 12, 10, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillRect(playerX + playerWidth / 2 - 3, playerY + 22, 6, 20);
      // Legs
      ctx.fillRect(playerX + playerWidth / 2 - 8, playerY + 42, 5, 8);
      ctx.fillRect(playerX + playerWidth / 2 + 3, playerY + 42, 5, 8);

      // Spawn obstacles
      frameCount++;
      if (frameCount % 90 === 0) {
        const height = 30 + Math.random() * 40;
        obstacles.push({
          x: canvas.width,
          y: groundY - height,
          width: 30,
          height: height,
        });
      }

      // Increase speed gradually
      if (frameCount % 500 === 0) {
        scrollSpeed += 0.5;
      }

      // Move and draw obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= scrollSpeed;

        // Draw obstacle (cactus style)
        ctx.fillStyle = "#2d5016";
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        // Spikes
        ctx.fillStyle = "#1a3009";
        for (let s = 0; s < 3; s++) {
          ctx.fillRect(obs.x - 5, obs.y + s * 15, 5, 10);
          ctx.fillRect(obs.x + obs.width, obs.y + s * 15, 5, 10);
        }

        // Check collision
        if (
          playerX < obs.x + obs.width &&
          playerX + playerWidth > obs.x &&
          playerY < obs.y + obs.height &&
          playerY + playerHeight > obs.y
        ) {
          // Game Over
          setGameOver(true);
          setScore(currentScore);
          window.removeEventListener("keydown", handleKeyDown);
          if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
          }
          return;
        }

        // Remove obstacle if out of bounds
        if (obs.x + obs.width < 0) {
          obstacles.splice(i, 1);
          currentScore += 5;
        }
      }

      // Draw score
      ctx.fillStyle = "#000";
      ctx.font = "bold 24px Arial";
      ctx.fillText(`Skor: ${currentScore}`, 20, 40);
      ctx.fillText(`Kecepatan: ${scrollSpeed.toFixed(1)}`, 20, 70);

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver]);

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
  };

  const restartGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setScore(0);
    setTimeout(() => startGame(), 100);
  };

  const saveScore = async () => {
    if (!user?.id || saving) return;

    setSaving(true);
    try {
      const points = Math.floor(score / 5);
      const res = await fetch("/api/user/games/save-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          game: "platform-jump",
          score,
          points,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notifications.show({
          title: "Berhasil!",
          message: `Skor ${score} disimpan! Kamu mendapat ${points} poin!`,
          color: "green",
        });
      } else {
        throw new Error(data.error || "Gagal menyimpan skor");
      }
    } catch (error: any) {
      notifications.show({
        title: "Gagal",
        message: error.message || "Gagal menyimpan skor",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={1} c="var(--primary-color)">
              🏃 Platform Jump
            </Title>
            <Text c="dimmed">
              Lompat untuk hindari rintangan dan raih skor tertinggi!
            </Text>
          </div>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            onClick={() => window.close()}
          >
            Tutup
          </Button>
        </Group>

        <Card withBorder radius="lg" p="lg">
          <Stack gap="md" align="center">
            {!gameStarted && !gameOver && (
              <Stack gap="md" align="center" style={{ padding: "2rem" }}>
                <Title order={2}>Cara Bermain</Title>
                <Stack gap="xs" align="start" style={{ maxWidth: 400 }}>
                  <Text>• Tekan SPASI untuk melompat</Text>
                  <Text>• Hindari rintangan (kaktus) yang datang</Text>
                  <Text>• Kecepatan akan bertambah seiring waktu</Text>
                  <Text>• Setiap rintangan yang terlewati = +5 skor</Text>
                  <Text>• Permainan berakhir jika kamu menabrak rintangan</Text>
                </Stack>
                <Button
                  size="lg"
                  onClick={startGame}
                  bg="var(--primary-color)"
                  style={{ marginTop: "1rem" }}
                >
                  Mulai Bermain
                </Button>
              </Stack>
            )}

            {gameStarted && (
              <div style={{ position: "relative" }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={400}
                  style={{
                    border: "4px solid var(--primary-color)",
                    borderRadius: 12,
                    maxWidth: "100%",
                  }}
                />
              </div>
            )}

            {gameOver && (
              <Card
                withBorder
                p="xl"
                radius="lg"
                style={{
                  background:
                    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  color: "#fff",
                  textAlign: "center",
                }}
              >
                <Stack gap="md" align="center">
                  <IconTrophy size={64} />
                  <Title order={2} c="white">
                    Game Over!
                  </Title>
                  <Badge size="xl" color="yellow" variant="filled">
                    Skor Akhir: {score}
                  </Badge>
                  <Text size="lg">
                    Poin yang didapat: {Math.floor(score / 5)}
                  </Text>
                  <Group gap="md">
                    <Button
                      leftSection={<IconRefresh size={16} />}
                      onClick={restartGame}
                      variant="white"
                      color="dark"
                    >
                      Main Lagi
                    </Button>
                    <Button
                      leftSection={<IconTrophy size={16} />}
                      onClick={saveScore}
                      loading={saving}
                      bg="var(--secondary-color)"
                      c="var(--primary-color)"
                    >
                      Simpan Skor
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
