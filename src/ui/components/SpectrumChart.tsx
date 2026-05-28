import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Checkbox,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip as MantineTooltip,
} from "@mantine/core";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ComparisonSpectrum,
  MultiSpectrumComparison,
  Peak,
  ROI,
} from "../../types/spectrum";

interface SpectrumChartProps {
  rawChannels: number[];
  displayChannels: number[];
  peaks: Peak[];
  rois: ROI[];
  comparison: ComparisonSpectrum | null;
  multiComparison: MultiSpectrumComparison | null;
  showPeaks: boolean;
  showRoi: boolean;
  selectedRoiId: string | null;
  totalInformation: number;
}

interface ZoomRange {
  startIndex: number;
  endIndex: number;
}

interface VisibleLines {
  source: boolean;
  background: boolean;
  combined: boolean;
}

const SOURCE_COLORS = [
  "#228be6",
  "#2f9e44",
  "#e8590c",
  "#ae3ec9",
  "#0ca678",
  "#c92a2a",
];

export function SpectrumChart({
  rawChannels,
  displayChannels,
  peaks,
  rois,
  comparison,
  multiComparison,
  showPeaks,
  showRoi,
  selectedRoiId,
  totalInformation,
}: SpectrumChartProps) {
  const visibleSources = useMemo(
    () => multiComparison?.sources.slice(0, 6) ?? [],
    [multiComparison],
  );
  const data = useMemo(
    () =>
      displayChannels.map((value, index) => {
        const element = comparison?.source.channels[index] ?? null;
        const background = comparison?.background.channels[index] ?? null;
        const row: Record<string, number | null> = {
          channel: index,
          source:
            comparison ? element : !multiComparison ? rawChannels[index] ?? value : null,
          element,
          background,
          combined:
            element !== null && background !== null ? element + background : null,
          spectrum:
            !multiComparison && !comparison ? rawChannels[index] ?? value : null,
        };

        visibleSources.forEach((source, sourceIndex) => {
          row[`source-${sourceIndex + 1}`] =
            source.spectrum.channels[index] ?? null;
        });

        return row;
      }),
    [comparison, displayChannels, multiComparison, rawChannels, visibleSources],
  );

  const [zoomRange, setZoomRange] = useState<ZoomRange>({
    startIndex: 0,
    endIndex: Math.max(0, data.length - 1),
  });
  const [visibleLines, setVisibleLines] = useState<VisibleLines>({
    source: true,
    background: true,
    combined: true,
  });

  function toggleLine(line: keyof VisibleLines) {
    setVisibleLines((current) => ({
      ...current,
      [line]: !current[line],
    }));
  }

  useEffect(() => {
    setZoomRange({
      startIndex: 0,
      endIndex: Math.max(0, data.length - 1),
    });
  }, [data.length]);

  return (
    <Card withBorder h="100%">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={5}>Спектр</Title>
          <Group gap={6} align="center">
            <Text size="sm" fw={700}>
              ИНФОРМАЦИЯ: {totalInformation.toFixed(4)}
            </Text>
            <MantineTooltip
              withArrow
              multiline
              w={360}
              label={
                <>
                  <Text size="md" fw={700}>
                    I = Σ sᵢ² / (sᵢ + bᵢ), где sᵢ — элемент, bᵢ — фон.
                  </Text>
                  <Text size="sm" c="dimmed">
                    sᵢ — вклад элемента в канале i, bᵢ — фоновые отсчёты в канале i.
                  </Text>
                </>
              }
            >
              <ThemeIcon size={18} radius="xl" variant="light" color="blue">
                i
              </ThemeIcon>
            </MantineTooltip>
          </Group>
        </Group>
        <Group gap="md">
          <Checkbox
            size="xs"
            checked={visibleLines.source}
            label={comparison ? "Элемент" : "Спектр"}
            onChange={() => toggleLine("source")}
          />
          <Checkbox
            size="xs"
            checked={visibleLines.background}
            label="Фон"
            disabled={!comparison}
            onChange={() => toggleLine("background")}
          />
          <Checkbox
            size="xs"
            checked={visibleLines.combined}
            label="Элемент + фон"
            disabled={!comparison}
            onChange={() => toggleLine("combined")}
          />
        </Group>

        <div style={{ width: "100%", height: 560 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dee2e6" />
              <XAxis
                type="number"
                dataKey="channel"
                domain={[zoomRange.startIndex, zoomRange.endIndex]}
                allowDataOverflow
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <RechartsTooltip />
              <Legend />

              {showRoi
                ? rois.map((roi) => {
                    const selected = roi.id === selectedRoiId;
                    return (
                      <ReferenceArea
                        key={roi.id}
                        x1={roi.startChannel}
                        x2={roi.endChannel}
                        fill="#3b82f6"
                        fillOpacity={selected ? 0.18 : 0.08}
                        stroke={selected ? "#1c7ed6" : "#74a9ff"}
                        strokeOpacity={selected ? 0.9 : 0.6}
                        strokeWidth={selected ? 2 : 1}
                        strokeDasharray={selected ? undefined : "4 3"}
                      />
                    );
                  })
                : null}

              {showPeaks
                ? peaks.map((peak) => (
                    <ReferenceLine
                      key={peak.id}
                      x={peak.refinedChannel}
                      stroke="#e03131"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                    />
                  ))
                : null}

              {multiComparison && visibleLines.source
                ? visibleSources.map((source, index) => (
                    <Line
                      key={source.id}
                      type="monotone"
                      dataKey={`source-${index + 1}`}
                      name={source.name}
                      stroke={SOURCE_COLORS[index]}
                      dot={false}
                      strokeWidth={1.2}
                      strokeOpacity={0.75}
                      isAnimationActive={false}
                    />
                  ))
                : !multiComparison && visibleLines.source ? (
                    <Line
                      type="monotone"
                      dataKey="source"
                      name={comparison ? "Элемент" : "Спектр"}
                      stroke="#228be6"
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  ) : null}
              {comparison && visibleLines.background ? (
                <Line
                  type="monotone"
                  dataKey="background"
                  name="Фон"
                  stroke="#868e96"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              ) : null}
              {comparison && visibleLines.combined ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="combined"
                    name="Элемент + фон"
                    stroke="#f08c00"
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </>
              ) : null}

              <Brush
                dataKey="channel"
                height={28}
                stroke="#868e96"
                travellerWidth={10}
                startIndex={zoomRange.startIndex}
                endIndex={zoomRange.endIndex}
                onChange={(nextRange) => {
                  setZoomRange({
                    startIndex: nextRange?.startIndex ?? 0,
                    endIndex: nextRange?.endIndex ?? Math.max(0, data.length - 1),
                  });
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Stack>
    </Card>
  );
}
