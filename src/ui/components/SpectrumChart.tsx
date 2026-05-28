import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Checkbox,
  Group,
  Stack,
  Switch,
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
  InformationTotals,
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
  informationTotals: InformationTotals;
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

type YScaleMode = "linear" | "ln";

const SOURCE_COLORS = [
  "#228be6",
  "#2f9e44",
  "#e8590c",
  "#ae3ec9",
  "#0ca678",
  "#c92a2a",
];

function toLnValue(value: number | null) {
  if (value === null) {
    return null;
  }

  return Math.log1p(Math.max(value, 0));
}

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
  informationTotals,
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
        const sourceValue =
          comparison ? element : !multiComparison ? rawChannels[index] ?? value : null;
        const combinedValue =
          element !== null && background !== null ? element + background : null;
        const spectrumValue =
          !multiComparison && !comparison ? rawChannels[index] ?? value : null;
        const row: Record<string, number | null> = {
          channel: index,
          source: sourceValue,
          "source-ln": toLnValue(sourceValue),
          element,
          background,
          "background-ln": toLnValue(background),
          combined: combinedValue,
          "combined-ln": toLnValue(combinedValue),
          spectrum: spectrumValue,
        };

        visibleSources.forEach((source, sourceIndex) => {
          const sourceChannelValue = source.spectrum.channels[index] ?? null;

          row[`source-${sourceIndex + 1}`] = sourceChannelValue;
          row[`source-${sourceIndex + 1}-ln`] = toLnValue(sourceChannelValue);
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
  const [yScaleMode, setYScaleMode] = useState<YScaleMode>("linear");

  const lineKeySuffix = yScaleMode === "ln" ? "-ln" : "";

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
              KL: {informationTotals.kl.toFixed(4)}
            </Text>
            <Text size="sm" fw={700}>
              Фишер: {informationTotals.fisher.toFixed(4)}
            </Text>
            <MantineTooltip
              withArrow
              multiline
              w={360}
              label={
                <>
                  <Text size="md" fw={700}>
                    KL = Σ((sᵢ + bᵢ) ln((sᵢ + bᵢ) / bᵢ) - sᵢ)
                  </Text>
                  <Text size="md" fw={700}>
                    Фишер = Σ sᵢ² / (sᵢ + bᵢ)
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
          <Switch
            size="xs"
            checked={yScaleMode === "ln"}
            label="ln(1+x) шкала"
            onChange={(event) =>
              setYScaleMode(event.currentTarget.checked ? "ln" : "linear")
            }
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
              <YAxis
                tick={{ fontSize: 12 }}
                width={64}
                tickFormatter={(tick) =>
                  yScaleMode === "ln"
                    ? Number(tick).toFixed(2)
                    : String(tick)
                }
              />
              <RechartsTooltip
                formatter={(value, name, item) => {
                  const dataKey =
                    typeof item.dataKey === "string"
                      ? item.dataKey.replace(/-ln$/, "")
                      : null;
                  const rawValue = dataKey ? item.payload?.[dataKey] : null;

                  if (typeof rawValue === "number" && yScaleMode === "ln") {
                    return [
                      `${rawValue.toFixed(2)} (ln(1+x) ${Number(value).toFixed(4)})`,
                      name,
                    ];
                  }

                  return [value, name];
                }}
              />
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
                      dataKey={`source-${index + 1}${lineKeySuffix}`}
                      name={source.name}
                      stroke={SOURCE_COLORS[index]}
                      dot={false}
                      strokeWidth={1.2}
                      strokeOpacity={0.75}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))
                : !multiComparison && visibleLines.source ? (
                    <Line
                      type="monotone"
                      dataKey={`source${lineKeySuffix}`}
                      name={comparison ? "Элемент" : "Спектр"}
                      stroke="#228be6"
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ) : null}
              {comparison && visibleLines.background ? (
                <Line
                  type="monotone"
                  dataKey={`background${lineKeySuffix}`}
                  name="Фон"
                  stroke="#868e96"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  connectNulls
                />
              ) : null}
              {comparison && visibleLines.combined ? (
                <>
                  <Line
                    type="monotone"
                    dataKey={`combined${lineKeySuffix}`}
                    name="Элемент + фон"
                    stroke="#f08c00"
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                    connectNulls
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
