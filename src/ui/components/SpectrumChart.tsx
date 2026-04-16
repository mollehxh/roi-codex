import { Card, Group, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import type { Peak, ROI } from "../../types/spectrum";

const CHART_PADDING = {
  top: 18,
  right: 18,
  bottom: 32,
  left: 44,
};

interface SpectrumChartProps {
  rawChannels: number[];
  displayChannels: number[];
  peaks: Peak[];
  rois: ROI[];
  showPeaks: boolean;
  showRoi: boolean;
  selectedRoiId: string | null;
  onSelectRoi: (roiId: string | null) => void;
}

function buildPath(
  channels: number[],
  width: number,
  height: number,
  minValue: number,
  maxValue: number,
) {
  if (channels.length === 0) {
    return "";
  }

  const plotWidth = Math.max(1, width - CHART_PADDING.left - CHART_PADDING.right);
  const plotHeight = Math.max(1, height - CHART_PADDING.top - CHART_PADDING.bottom);
  const denominator = maxValue - minValue || 1;

  return channels
    .map((value, index) => {
      const x =
        CHART_PADDING.left +
        (index / Math.max(1, channels.length - 1)) * plotWidth;
      const y =
        CHART_PADDING.top +
        plotHeight -
        ((value - minValue) / denominator) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function projectChannel(channel: number, channelCount: number, width: number) {
  const plotWidth = Math.max(1, width - CHART_PADDING.left - CHART_PADDING.right);
  return (
    CHART_PADDING.left +
    (channel / Math.max(1, channelCount - 1)) * plotWidth
  );
}

function projectValue(value: number, minValue: number, maxValue: number, height: number) {
  const plotHeight = Math.max(1, height - CHART_PADDING.top - CHART_PADDING.bottom);
  return (
    CHART_PADDING.top +
    plotHeight -
    ((value - minValue) / Math.max(maxValue - minValue, 1e-9)) * plotHeight
  );
}

export function SpectrumChart({
  rawChannels,
  displayChannels,
  peaks,
  rois,
  showPeaks,
  showRoi,
  selectedRoiId,
  onSelectRoi,
}: SpectrumChartProps) {
  const { ref, width } = useElementSize();
  const height = 420;
  const maxDisplayValue = Math.max(...displayChannels, 0);
  const yTicks = 4;
  const rawPath = buildPath(rawChannels, width, height, 0, Math.max(...rawChannels, 0));
  const displayPath = buildPath(displayChannels, width, height, 0, maxDisplayValue);

  return (
    <Card withBorder radius="lg" padding="lg" h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <div>
            <Text fw={700}>Спектр и ROI</Text>
            <Text size="sm" c="dimmed">
              Основная линия показывает preprocessed spectrum, серая линия показывает raw counts.
            </Text>
          </div>
          <Text size="sm" c="dimmed">
            Каналы 0-1023
          </Text>
        </Group>
        <div ref={ref} style={{ width: "100%", flex: 1, minHeight: height }}>
          {width > 0 ? (
            <svg width={width} height={height} role="img" aria-label="Spectrum chart">
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                rx={16}
                fill="var(--mantine-color-dark-0)"
              />
              {Array.from({ length: yTicks + 1 }, (_, index) => {
                const ratio = index / yTicks;
                const y =
                  CHART_PADDING.top +
                  ratio * (height - CHART_PADDING.top - CHART_PADDING.bottom);
                const value = ((1 - ratio) * maxDisplayValue).toFixed(2);

                return (
                  <g key={`tick-${value}`}>
                    <line
                      x1={CHART_PADDING.left}
                      x2={width - CHART_PADDING.right}
                      y1={y}
                      y2={y}
                      stroke="rgba(23, 32, 42, 0.08)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={10}
                      y={y + 4}
                      fill="var(--mantine-color-gray-6)"
                      fontSize={11}
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
              {showRoi
                ? rois.map((roi) => {
                    const x = projectChannel(roi.startChannel, displayChannels.length, width);
                    const endX = projectChannel(roi.endChannel, displayChannels.length, width);
                    const selected = roi.id === selectedRoiId;

                    return (
                      <rect
                        key={roi.id}
                        x={x}
                        y={CHART_PADDING.top}
                        width={Math.max(2, endX - x)}
                        height={height - CHART_PADDING.top - CHART_PADDING.bottom}
                        fill={selected ? "rgba(0, 112, 243, 0.18)" : "rgba(255, 170, 0, 0.12)"}
                        stroke={selected ? "rgba(0, 112, 243, 0.85)" : "rgba(235, 153, 35, 0.8)"}
                        strokeWidth={selected ? 2 : 1}
                        onMouseEnter={() => onSelectRoi(roi.id)}
                        onMouseLeave={() => onSelectRoi(null)}
                      />
                    );
                  })
                : null}
              <path
                d={rawPath}
                fill="none"
                stroke="rgba(94, 106, 122, 0.45)"
                strokeWidth={1.2}
              />
              <path
                d={displayPath}
                fill="none"
                stroke="rgba(0, 112, 243, 0.95)"
                strokeWidth={2.2}
              />
              {showPeaks
                ? peaks.map((peak) => {
                    const x = projectChannel(
                      peak.refinedChannel,
                      displayChannels.length,
                      width,
                    );
                    const y = projectValue(peak.value, 0, maxDisplayValue, height);
                    return (
                      <g key={peak.id}>
                        <line
                          x1={x}
                          x2={x}
                          y1={CHART_PADDING.top}
                          y2={height - CHART_PADDING.bottom}
                          stroke="rgba(214, 40, 40, 0.65)"
                          strokeDasharray="6 5"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={4.5}
                          fill="rgba(214, 40, 40, 1)"
                        />
                      </g>
                    );
                  })
                : null}
              <line
                x1={CHART_PADDING.left}
                x2={width - CHART_PADDING.right}
                y1={height - CHART_PADDING.bottom}
                y2={height - CHART_PADDING.bottom}
                stroke="var(--mantine-color-gray-5)"
              />
              <line
                x1={CHART_PADDING.left}
                x2={CHART_PADDING.left}
                y1={CHART_PADDING.top}
                y2={height - CHART_PADDING.bottom}
                stroke="var(--mantine-color-gray-5)"
              />
              <text
                x={width / 2}
                y={height - 6}
                textAnchor="middle"
                fill="var(--mantine-color-gray-7)"
                fontSize={12}
              >
                Channel
              </text>
            </svg>
          ) : null}
        </div>
      </Stack>
    </Card>
  );
}
