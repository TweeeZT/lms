"use client";

import { Modal, Stack, Text, Button, Group } from "@mantine/core";
import { IconCoin } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Image from "next/image";

interface RewardModalProps {
  opened: boolean;
  onClose: () => void;
  points: number;
  coins: number;
}

export default function RewardModal({
  opened,
  onClose,
  points,
  coins,
}: RewardModalProps) {
  const [animatePoints, setAnimatePoints] = useState(false);
  const [animateCoins, setAnimateCoins] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);

  useEffect(() => {
    if (opened) {
      // Reset animation states
      setAnimatePoints(false);
      setAnimateCoins(false);
      setDisplayPoints(0);
      setDisplayCoins(0);

      // Trigger animations with delays
      const pointsTimer = setTimeout(() => setAnimatePoints(true), 300);
      const coinsTimer = setTimeout(() => setAnimateCoins(true), 600);

      // Animate counters
      const duration = 1000;
      const steps = 30;
      const pointsIncrement = points / steps;
      const coinsIncrement = coins / steps;
      let currentStep = 0;

      const counterInterval = setInterval(() => {
        currentStep++;
        if (currentStep <= steps) {
          setDisplayPoints(Math.round(pointsIncrement * currentStep));
          setDisplayCoins(Math.round(coinsIncrement * currentStep));
        } else {
          setDisplayPoints(points);
          setDisplayCoins(coins);
          clearInterval(counterInterval);
        }
      }, duration / steps);

      return () => {
        clearTimeout(pointsTimer);
        clearTimeout(coinsTimer);
        clearInterval(counterInterval);
      };
    }
  }, [opened, points, coins]);

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        centered
        size="md"
        withCloseButton={false}
        padding={0}
        radius="lg"
        styles={{
          body: { padding: 0 },
          content: {
            overflow: "hidden",
            background: "rgb(30, 55, 105)", // Solid primary color - NO GRADIENT
          },
        }}
      >
        <Stack
          gap={0}
          align="center"
          p="xl"
          style={{
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 50,
              height: 50,
            }}
          >
            <Image
              src="/rewards/trophy.svg"
              alt="Coin"
              width={50}
              height={50}
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
              }}
            />
          </div>

          <Text
            size="28px"
            fw={700}
            style={{
              color: "rgb(246, 212, 87)", // Solid secondary color
              textAlign: "center",
              marginBottom: 8,
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }}
          >
            Selamat!
          </Text>

          <Text
            size="16px"
            style={{
              color: "rgb(246, 212, 87)", // Solid secondary color
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            Kamu mendapatkan reward
          </Text>

          {/* Rewards Display */}
          <Stack gap="md" style={{ width: "100%" }}>
            {/* Points Card - Always show */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.98)",
                borderRadius: 16,
                padding: "20px 24px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                border: "2px solid rgba(246, 212, 87, 0.3)",
                transform: animatePoints
                  ? "scale(1) translateY(0)"
                  : "scale(0.8) translateY(20px)",
                opacity: animatePoints ? 1 : 0,
                transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <Group gap="md" justify="space-between">
                <Group gap="sm">
                  <div>
                    <Text size="sm" c="dimmed" fw={500}>
                      Point
                    </Text>
                    <Text
                      size="32px"
                      fw={700}
                      style={{
                        color: "rgb(30, 55, 105)", // Solid primary color - NO GRADIENT
                        lineHeight: 1,
                      }}
                    >
                      +{displayPoints.toLocaleString()}
                    </Text>
                  </div>
                </Group>
                <div
                  style={{
                    position: "relative",
                    width: 32,
                    height: 32,
                    animation: animateCoins
                      ? "spin 2s linear infinite"
                      : "none",
                  }}
                >
                  <Image
                    src="/rewards/celebration.svg"
                    alt="Coin"
                    width={32}
                    height={32}
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                    }}
                  />
                </div>
              </Group>
            </div>

            {/* Coins Card - Always show */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.98)",
                borderRadius: 16,
                padding: "20px 24px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                border: "2px solid rgba(30, 55, 105, 0.2)",
                transform: animateCoins
                  ? "scale(1) translateY(0)"
                  : "scale(0.8) translateY(20px)",
                opacity: animateCoins ? 1 : 0,
                transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transitionDelay: "0.2s",
              }}
            >
              <Group gap="md" justify="space-between">
                <Group gap="sm">
                  <div>
                    <Text size="sm" c="dimmed" fw={500}>
                      Koin
                    </Text>
                    <Text
                      size="32px"
                      fw={700}
                      style={{
                        color: "rgb(246, 212, 87)", // Solid secondary color - NO GRADIENT
                        lineHeight: 1,
                      }}
                    >
                      +{displayCoins.toLocaleString()}
                    </Text>
                  </div>
                </Group>
                {/* Coin image with animation */}
                <div
                  style={{
                    position: "relative",
                    width: 32,
                    height: 32,
                    animation: animateCoins
                      ? "spin 2s linear infinite"
                      : "none",
                  }}
                >
                  <Image
                    src="/rewards/coin-gold.svg"
                    alt="Coin"
                    width={32}
                    height={32}
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                    }}
                  />
                </div>
              </Group>
            </div>
          </Stack>

          {/* Close Button */}
          <Button
            onClick={onClose}
            size="lg"
            fullWidth
            mt="xl"
            radius="xl"
            style={{
              background: "rgb(246, 212, 87)",
              color: "rgb(30, 55, 105)",
              fontWeight: 700,
              fontSize: 16,
              height: 48,
              boxShadow: "0 4px 16px rgba(246, 212, 87, 0.3)",
              flexShrink: 0,
            }}
            styles={{
              root: {
                "&:hover": {
                  background: "rgb(246, 212, 87)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 6px 20px rgba(246, 212, 87, 0.5)",
                },
                transition: "all 0.2s ease",
              },
            }}
          >
            Oke, Terima Kasih!
          </Button>
        </Stack>
      </Modal>

      <style jsx global>{`
        @keyframes bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2) rotate(180deg);
          }
        }

        @keyframes spin {
          from {
            transform: rotateY(0deg);
          }
          to {
            transform: rotateY(360deg);
          }
        }

        @media (max-width: 768px) {
          .mantine-Modal-content {
            margin: 16px;
            max-width: calc(100vw - 32px);
          }
          .mantine-Modal-body {
            padding: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .mantine-Modal-content {
            margin: 12px;
            max-width: calc(100vw - 24px);
          }
          .mantine-Modal-body {
            padding: 12px !important;
          }
        }
      `}</style>
    </>
  );
}
