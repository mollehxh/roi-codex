import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { SpectrumAnalysisResult } from "../../types/spectrum";

interface SummaryStatsProps {
  analysis: SpectrumAnalysisResult;
}

export function SummaryStats({ analysis }: SummaryStatsProps) {
  const maxValue = Math.max(...analysis.processed.corrected, 0);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
      <Card withBorder>
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            Авто пики
          </Text>
          <Text fw={700} size="xl">
            {analysis.suggestedPeaks.length}
          </Text>
          <Text size="sm" c="dimmed">
            Найдены алгоритмом
          </Text>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            Пики / ROI
          </Text>
          <Text fw={700} size="xl">
            {analysis.peaks.length} / {analysis.rois.length}
          </Text>
          <Text size="sm" c="dimmed">
            После текущего анализа
          </Text>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            Максимум сигнала
          </Text>
          <Text fw={700} size="xl">
            {maxValue.toFixed(2)}
          </Text>
          <Text size="sm" c="dimmed">
            Суммарная информация: {analysis.comparison?.totalInformation.toFixed(4) ?? "0.0000"}
          </Text>
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
