import {
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
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
      <Text fw={600} size="sm">
        Preprocessing
      </Text>
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
        label="Baseline correction"
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
      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Нормализация
        </Text>
        <SegmentedControl
          data={[
            { label: "None", value: "none" },
            { label: "Sum", value: "sum" },
          ]}
          value={value.normalizationMode}
          onChange={(next) =>
            onChange({
              ...value,
              normalizationMode: next as PreprocessingSettings["normalizationMode"],
            })
          }
        />
      </Stack>
    </Stack>
  );
}
