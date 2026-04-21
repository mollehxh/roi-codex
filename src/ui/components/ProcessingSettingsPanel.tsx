import { NumberInput, Stack, Switch } from "@mantine/core";
import type { PreprocessingSettings } from "../../types/spectrum";

interface ProcessingSettingsPanelProps {
  value: PreprocessingSettings;
  onChange: (value: PreprocessingSettings) => void;
}

export function ProcessingSettingsPanel({
  value,
  onChange,
}: ProcessingSettingsPanelProps) {
  return (
    <Stack gap="sm">
      <NumberInput
        label="Окно сглаживания"
        min={3}
        max={41}
        step={2}
        value={value.smoothingWindow}
        onChange={(next) =>
          onChange({
            ...value,
            smoothingWindow: Number(next) || 5,
          })
        }
      />
      <Switch
        label="Коррекция baseline"
        checked={value.useBaselineCorrection}
        onChange={(event) =>
          onChange({
            ...value,
            useBaselineCorrection: event.currentTarget.checked,
          })
        }
      />
      <NumberInput
        label="Окно baseline"
        min={11}
        max={301}
        step={2}
        value={value.baselineWindow}
        onChange={(next) =>
          onChange({
            ...value,
            baselineWindow: Number(next) || 51,
          })
        }
      />
    </Stack>
  );
}
