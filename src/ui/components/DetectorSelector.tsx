import { MultiSelect, Stack, Text } from "@mantine/core";
import type { DetectorSpectrum } from "../../types/spectrum";

interface DetectorSelectorProps {
  detectors: DetectorSpectrum[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function DetectorSelector({
  detectors,
  value,
  onChange,
}: DetectorSelectorProps) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Детекторы
      </Text>
      <MultiSelect
        data={detectors.map((detector) => ({
          value: detector.detectorId,
          label: detector.name,
        }))}
        value={value}
        onChange={onChange}
        searchable
        clearable={false}
        placeholder="Выберите детекторы"
        nothingFoundMessage="Нет детекторов"
      />
      <Text size="xs" c="dimmed">
        При мультивыборе каналы усредняются перед preprocessing и поиском ROI.
      </Text>
    </Stack>
  );
}
