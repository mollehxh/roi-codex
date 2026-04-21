import { Stack, Switch } from "@mantine/core";
import type { OverlayVisibility } from "../../types/spectrum";

interface RoiSettingsPanelProps {
  overlayVisibility: OverlayVisibility;
  onOverlayVisibilityChange: (value: OverlayVisibility) => void;
}

export function RoiSettingsPanel({
  overlayVisibility,
  onOverlayVisibilityChange,
}: RoiSettingsPanelProps) {
  return (
    <Stack gap="sm">
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
        label="Показывать границы ROI"
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
