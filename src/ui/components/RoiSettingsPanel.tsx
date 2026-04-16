import { NumberInput, Stack, Switch, Text } from "@mantine/core";
import type {
  OverlayVisibility,
  PeakDetectionSettings,
  RoiDetectionSettings,
} from "../../types/spectrum";

interface RoiSettingsPanelProps {
  peakSettings: PeakDetectionSettings;
  roiSettings: RoiDetectionSettings;
  overlayVisibility: OverlayVisibility;
  onPeakSettingsChange: (value: PeakDetectionSettings) => void;
  onRoiSettingsChange: (value: RoiDetectionSettings) => void;
  onOverlayVisibilityChange: (value: OverlayVisibility) => void;
}

export function RoiSettingsPanel({
  peakSettings,
  roiSettings,
  overlayVisibility,
  onPeakSettingsChange,
  onRoiSettingsChange,
  onOverlayVisibilityChange,
}: RoiSettingsPanelProps) {
  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        ROI и пики
      </Text>
      <NumberInput
        label="Min height ratio"
        min={0.001}
        max={0.5}
        step={0.005}
        decimalScale={3}
        value={peakSettings.minHeightRatio}
        onChange={(next) =>
          onPeakSettingsChange({
            ...peakSettings,
            minHeightRatio: Number(next) || peakSettings.minHeightRatio,
          })
        }
      />
      <NumberInput
        label="Min prominence"
        min={0.0001}
        max={0.2}
        step={0.001}
        decimalScale={4}
        value={peakSettings.minProminence}
        onChange={(next) =>
          onPeakSettingsChange({
            ...peakSettings,
            minProminence: Number(next) || peakSettings.minProminence,
          })
        }
      />
      <NumberInput
        label="Min peak distance"
        min={1}
        max={100}
        step={1}
        value={peakSettings.minDistance}
        onChange={(next) =>
          onPeakSettingsChange({
            ...peakSettings,
            minDistance: Number(next) || peakSettings.minDistance,
          })
        }
      />
      <NumberInput
        label="Max ROI expansion"
        min={8}
        max={256}
        step={4}
        value={roiSettings.maxExpansion}
        onChange={(next) =>
          onRoiSettingsChange({
            ...roiSettings,
            maxExpansion: Number(next) || roiSettings.maxExpansion,
          })
        }
      />
      <NumberInput
        label="Min ROI width"
        min={3}
        max={64}
        step={1}
        value={roiSettings.minRoiWidth}
        onChange={(next) =>
          onRoiSettingsChange({
            ...roiSettings,
            minRoiWidth: Number(next) || roiSettings.minRoiWidth,
          })
        }
      />
      <Switch
        label="Показывать пики"
        checked={overlayVisibility.showPeaks}
        onChange={(event) =>
          onOverlayVisibilityChange({
            ...overlayVisibility,
            showPeaks: event.currentTarget.checked,
          })
        }
      />
      <Switch
        label="Показывать ROI"
        checked={overlayVisibility.showRoi}
        onChange={(event) =>
          onOverlayVisibilityChange({
            ...overlayVisibility,
            showRoi: event.currentTarget.checked,
          })
        }
      />
    </Stack>
  );
}
