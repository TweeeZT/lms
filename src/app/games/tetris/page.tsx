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

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 25;

const SHAPES = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [0, 1, 0],
    [1, 1, 1],
  ], // T
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // S
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // Z
  [
    [1, 0, 0],
    [1, 1, 1],
  ], // L
  [
    [0, 0, 1],
    [1, 1, 1],
  ], // J
];

const COLORS = [
  "#00f0f0",
  "#f0f000",
  "#a000f0",
  "#00f000",
  "#f00000",
  "#f0a000",
  "#0000f0",
];

export default function TetrisGame() {
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

    // Game state
    const board: number[][] = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    let currentPiece: {
      shape: number[][];
      x: number;
      y: number;
      color: number;
    } | null = null;
    let currentScore = 0;
    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;

    const createPiece = () => {
      const shapeIndex = Math.floor(Math.random() * SHAPES.length);
      return {
        shape: SHAPES[shapeIndex],
        x: Math.floor(COLS / 2) - 1,
        y: 0,
        color: shapeIndex,
      };
    };

    const collide = (piece: typeof currentPiece) => {
      if (!piece) return true;
      const { shape, x, y } = piece;
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col] !== 0) {
            const newY = y + row;
            const newX = x + col;
            if (
              newY >= ROWS ||
              newX < 0 ||
              newX >= COLS ||
              (newY >= 0 && board[newY][newX] !== 0)
            ) {
              return true;
            }
          }
        }
      }
      return false;
    };

    const merge = () => {
      if (!currentPiece) return;
      const { shape, x, y, color } = currentPiece;
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col] !== 0) {
            const newY = y + row;
            const newX = x + col;
            if (newY >= 0) {
              board[newY][newX] = color + 1;
            }
          }
        }
      }
    };

    const clearLines = () => {
      let linesCleared = 0;
      outer: for (let row = ROWS - 1; row >= 0; row--) {
        for (let col = 0; col < COLS; col++) {
          if (board[row][col] === 0) continue outer;
        }
        // Line is full
        board.splice(row, 1);
        board.unshift(Array(COLS).fill(0));
        linesCleared++;
        row++; // Check same row again
      }
      if (linesCleared > 0) {
        currentScore += linesCleared * 100;
        // Increase speed slightly
        dropInterval = Math.max(100, dropInterval - 50);
      }
    };

    const rotate = (piece: number[][]) => {
      const rotated = piece[0].map((_, i) =>
        piece.map((row) => row[i]).reverse()
      );
      return rotated;
    };

    const drop = () => {
      if (!currentPiece) return;
      currentPiece.y++;
      if (collide(currentPiece)) {
        currentPiece.y--;
        merge();
        clearLines();
        currentPiece = createPiece();
        if (collide(currentPiece)) {
          // Game over
          setGameOver(true);
          setScore(currentScore);
          return true;
        }
      }
      dropCounter = 0;
      return false;
    };

    const move = (dir: number) => {
      if (!currentPiece) return;
      currentPiece.x += dir;
      if (collide(currentPiece)) {
        currentPiece.x -= dir;
      }
    };

    const hardDrop = () => {
      if (!currentPiece) return;
      while (!collide(currentPiece)) {
        currentPiece.y++;
      }
      currentPiece.y--;
      merge();
      clearLines();
      currentPiece = createPiece();
      if (collide(currentPiece)) {
        setGameOver(true);
        setScore(currentScore);
      }
    };

    const rotatePiece = () => {
      if (!currentPiece) return;
      const rotated = rotate(currentPiece.shape);
      const originalShape = currentPiece.shape;
      currentPiece.shape = rotated;
      if (collide(currentPiece)) {
        currentPiece.shape = originalShape;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowDown") drop();
      if (e.key === "ArrowUp") rotatePiece();
      if (e.key === " ") hardDrop();
    };

    window.addEventListener("keydown", handleKeyDown);

    const draw = () => {
      // Clear
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw board
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (board[row][col] !== 0) {
            ctx.fillStyle = COLORS[board[row][col] - 1];
            ctx.fillRect(
              col * BLOCK_SIZE,
              row * BLOCK_SIZE,
              BLOCK_SIZE - 1,
              BLOCK_SIZE - 1
            );
          }
        }
      }

      // Draw current piece
      if (currentPiece) {
        ctx.fillStyle = COLORS[currentPiece.color];
        const { shape, x, y } = currentPiece;
        for (let row = 0; row < shape.length; row++) {
          for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col] !== 0) {
              ctx.fillRect(
                (x + col) * BLOCK_SIZE,
                (y + row) * BLOCK_SIZE,
                BLOCK_SIZE - 1,
                BLOCK_SIZE - 1
              );
            }
          }
        }
      }

      // Draw grid
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 0.5;
      for (let row = 0; row <= ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, row * BLOCK_SIZE);
        ctx.stroke();
      }
      for (let col = 0; col <= COLS; col++) {
        ctx.beginPath();
        ctx.moveTo(col * BLOCK_SIZE, 0);
        ctx.lineTo(col * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
      }
    };

    const update = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;
      dropCounter += deltaTime;

      if (dropCounter > dropInterval) {
        if (drop()) {
          // Game over
          if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
          }
          window.removeEventListener("keydown", handleKeyDown);
          return;
        }
      }

      draw();
      gameLoopRef.current = requestAnimationFrame(update);
    };

    currentPiece = createPiece();
    gameLoopRef.current = requestAnimationFrame(update);

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
      const points = Math.floor(score / 50);
      const res = await fetch("/api/user/games/save-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          game: "tetris",
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
              🧩 Tetris
            </Title>
            <Text c="dimmed">
              Susun balok dan hapus baris untuk mendapat skor!
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
                  <Text>• Gunakan ← → untuk menggeser balok</Text>
                  <Text>• Gunakan ↑ untuk memutar balok</Text>
                  <Text>• Gunakan ↓ untuk mempercepat jatuh</Text>
                  <Text>• Tekan SPASI untuk hard drop (langsung jatuh)</Text>
                  <Text>• Hapus baris penuh untuk mendapat +100 skor</Text>
                  <Text>• Permainan berakhir jika balok mencapai atas</Text>
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
                  width={COLS * BLOCK_SIZE}
                  height={ROWS * BLOCK_SIZE}
                  style={{
                    border: "4px solid var(--primary-color)",
                    borderRadius: 12,
                    background: "#000",
                  }}
                />
                <Card
                  withBorder
                  p="md"
                  style={{
                    position: "absolute",
                    top: 10,
                    right: -200,
                    width: 180,
                  }}
                >
                  <Stack gap="xs">
                    <Text fw={700} size="lg" c="var(--primary-color)">
                      Skor
                    </Text>
                    <Badge size="xl" variant="filled" bg="var(--primary-color)">
                      {score}
                    </Badge>
                  </Stack>
                </Card>
              </div>
            )}

            {gameOver && (
              <Card
                withBorder
                p="xl"
                radius="lg"
                style={{
                  background:
                    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
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
                    Poin yang didapat: {Math.floor(score / 50)}
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
