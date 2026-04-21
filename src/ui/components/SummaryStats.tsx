import { Card, Stack, Text } from "@mantine/core";
import type { SpectrumAnalysisResult } from "../../types/spectrum";

interface SummaryStatsProps {
  analysis: SpectrumAnalysisResult;
}

export function SummaryStats({ analysis }: SummaryStatsProps) {
  const maxValue = Math.max(...analysis.processed.corrected, 0);
  const totalInformation =
    analysis.multiComparison?.totalInformation ??
    analysis.comparison?.totalInformation ??
    0;
  const formattedMaxValue =
    maxValue >= 0.01 ? maxValue.toFixed(2) : maxValue.toExponential(2);

  return (
    <Card withBorder>
      <Stack gap={2}>
        <Text size="sm" c="dimmed">
          Максимум сигнала
        </Text>
        <Text fw={700} size="xl">
          {formattedMaxValue}
        </Text>
        <Text size="sm" c="dimmed">
          Суммарная информация: {totalInformation.toFixed(4)}
        </Text>
      </Stack>
    </Card>
  );
}
