"use client";

import { Radio, Stack, Text, Card } from "@mantine/core";

interface QuizQuestionProps {
  question: {
    id: string;
    question: string;
    q_type: string;
    options: string[];
  };
  selectedAnswer: string;
  onAnswerChange: (questionId: string, answer: string) => void;
  questionNumber: number;
}

export default function QuizQuestion({
  question,
  selectedAnswer,
  onAnswerChange,
  questionNumber,
}: QuizQuestionProps) {
  // Handle true/false questions properly
  const isTrueFalse = question.q_type === "true-false";
  const displayOptions = isTrueFalse
    ? ["Benar", "Salah"]
    : question.options?.filter((opt) => opt && opt.trim() !== "") || [];

  return (
    <Card withBorder p="md" radius="md">
      <Stack gap="md">
        <Text fw={600} size="lg">
          {questionNumber}. {question.question}
        </Text>
        {isTrueFalse ? (
          <Radio.Group
            value={selectedAnswer}
            onChange={(val) => onAnswerChange(question.id, val)}
          >
            <Stack gap="sm">
              <Radio value="true" label="Benar" />
              <Radio value="false" label="Salah" />
            </Stack>
          </Radio.Group>
        ) : (
          <Radio.Group
            value={selectedAnswer}
            onChange={(val) => onAnswerChange(question.id, val)}
          >
            <Stack gap="sm">
              {displayOptions.map((option, idx) => (
                <Radio key={idx} value={String(idx)} label={option} />
              ))}
            </Stack>
          </Radio.Group>
        )}
      </Stack>
    </Card>
  );
}
