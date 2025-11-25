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

export default function AvoidCarGame() {
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
    let playerX = canvas.width / 2 - 25;
    const playerY = canvas.height - 120;
    const playerWidth = 50;
    const playerHeight = 80;
    let speed = 3;
    const obstacles: { x: number; y: number; width: number; height: number }[] =
      [];
    let frameCount = 0;
    let currentScore = 0;

    // Handle keyboard
    const keys: { [key: string]: boolean } = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Game loop
    const gameLoop = () => {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw road
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 15]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      // Move player
      if (keys["ArrowLeft"] && playerX > 0) {
        playerX -= 6;
      }
      if (keys["ArrowRight"] && playerX < canvas.width - playerWidth) {
        playerX += 6;
      }

      // Draw player (blue car)
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(playerX, playerY, playerWidth, playerHeight);
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(playerX + 10, playerY + 10, 10, 20);
      ctx.fillRect(playerX + 30, playerY + 10, 10, 20);

      // Spawn obstacles
      frameCount++;
      if (frameCount % 60 === 0) {
        const lanes = [50, 150, 250, 350];
        const lane = lanes[Math.floor(Math.random() * lanes.length)];
        obstacles.push({ x: lane, y: -100, width: 50, height: 80 });
      }

      // Increase speed gradually
      if (frameCount % 300 === 0) {
        speed += 0.5;
      }

      // Move and draw obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += speed;

        // Draw obstacle (red car)
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = "#991b1b";
        ctx.fillRect(obs.x + 10, obs.y + 50, 10, 20);
        ctx.fillRect(obs.x + 30, obs.y + 50, 10, 20);

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
          window.removeEventListener("keyup", handleKeyUp);
          if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
          }
          return;
        }

        // Remove obstacle if out of bounds
        if (obs.y > canvas.height) {
          obstacles.splice(i, 1);
          currentScore += 10;
        }
      }

      // Draw score
      ctx.fillStyle = "#fff";
      ctx.font = "24px Arial";
      ctx.fillText(`Skor: ${currentScore}`, 20, 40);
      ctx.fillText(`Kecepatan: ${speed.toFixed(1)}`, 20, 70);

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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
      const points = Math.floor(score / 10);
      const res = await fetch("/api/user/games/save-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          game: "avoid-car",
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
              🚗 Hindari Mobil
            </Title>
            <Text c="dimmed">
              Hindari mobil lain dan kumpulkan skor setinggi mungkin!
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
                  <Text>• Gunakan tombol ← → untuk menggerakkan mobil</Text>
                  <Text>• Hindari mobil merah yang datang dari atas</Text>
                  <Text>• Kecepatan akan bertambah seiring waktu</Text>
                  <Text>• Setiap mobil yang terlewati = +10 skor</Text>
                  <Text>
                    • Permainan berakhir jika kamu menabrak mobil lain
                  </Text>
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
                  width={450}
                  height={600}
                  style={{
                    border: "4px solid var(--primary-color)",
                    borderRadius: 12,
                    background: "#2c3e50",
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
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
                    Poin yang didapat: {Math.floor(score / 10)}
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
