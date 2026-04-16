import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { SpectrumAnalysisResult } from "../../types/spectrum";

interface SummaryStatsProps {
  analysis: SpectrumAnalysisResult;
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card radius="md" withBorder padding="md">
      <Stack gap={2}>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
          {label}
        </Text>
        <Text size="xl" fw={700}>
          {value}
        </Text>
        <Text size="xs" c="dimmed">
          {helper}
        </Text>
      </Stack>
    </Card>
  );
}

export function SummaryStats({ analysis }: SummaryStatsProps) {
  const maxValue = Math.max(...analysis.processed.corrected, 0);
  const totalCounts = analysis.aggregated.channels.reduce(
    (accumulator, value) => accumulator + value,
    0,
  );

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
      <StatCard
        label="Активные детекторы"
        value={String(analysis.aggregated.detectorIds.length)}
        helper="Используются в текущем агрегированном спектре"
      />
      <StatCard
        label="Найдено пиков"
        value={String(analysis.peaks.length)}
        helper="После preprocessing и peak refinement"
      />
      <StatCard
        label="Найдено ROI"
        value={String(analysis.rois.length)}
        helper="Границы отфильтрованы по score и пересечениям"
      />
      <StatCard
        label="Максимум сигнала"
        value={maxValue.toFixed(2)}
        helper={`Суммарные counts: ${totalCounts.toFixed(1)}`}
      />
    </SimpleGrid>
  );
}
