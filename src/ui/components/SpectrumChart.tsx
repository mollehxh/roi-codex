import { useEffect, useMemo, useState } from "react";
import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
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
}

interface ZoomRange {
  startIndex: number;
  endIndex: number;
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
}: SpectrumChartProps) {
  const visibleSources = useMemo(
    () => multiComparison?.sources.slice(0, 6) ?? [],
    [multiComparison],
  );
  const data = useMemo(
    () =>
      displayChannels.map((value, index) => {
        const row: Record<string, number | null> = {
          channel: index,
          source: comparison?.source.channels[index] ?? null,
          background: comparison?.background.channels[index] ?? null,
          difference: multiComparison
            ? null
            : comparison?.difference.channels[index] ?? rawChannels[index] ?? null,
          processed: multiComparison ? null : value,
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

  useEffect(() => {
    setZoomRange({
      startIndex: 0,
      endIndex: Math.max(0, data.length - 1),
    });
  }, [data.length]);

  return (
    <Card withBorder h="100%">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={5}>Спектр</Title>
            <Text size="sm" c="dimmed">
              Спектры и фон. ROI подсвечиваются цветом, диапазон можно
              масштабировать.
            </Text>
          </div>
          <Button
            variant="default"
            size="xs"
            onClick={() =>
              setZoomRange({
                startIndex: 0,
                endIndex: Math.max(0, data.length - 1),
              })
            }
            disabled={
              zoomRange.startIndex === 0 &&
              zoomRange.endIndex === Math.max(0, data.length - 1)
            }
          >
            Сбросить зум
          </Button>
        </Group>

        <div style={{ width: "100%", height: 460 }}>
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
              <Tooltip />
              <Legend />

              {showRoi
                ? rois.map((roi) => {
                    const selected = roi.id === selectedRoiId;
                    return (
                      <ReferenceArea
                        key={roi.id}
                        x1={roi.startChannel}
                        x2={roi.endChannel}
                        fill={selected ? "#228be6" : "#ffd43b"}
                        fillOpacity={selected ? 0.3 : 0.18}
                        stroke={selected ? "#1c7ed6" : "#f59f00"}
                        strokeOpacity={selected ? 0.9 : 0.55}
                        strokeWidth={selected ? 2 : 1}
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

              {multiComparison
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
                : (
                    <Line
                      type="monotone"
                      dataKey="source"
                      name="Источник"
                      stroke="#228be6"
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  )}
              <Line
                type="monotone"
                dataKey="background"
                name="Фон"
                stroke="#868e96"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              {!multiComparison ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="difference"
                    name="Разность"
                    stroke="#f08c00"
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="processed"
                    name="Обработанный"
                    stroke="#1971c2"
                    dot={false}
                    strokeWidth={2}
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
