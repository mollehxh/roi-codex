import { Select } from "@mantine/core";
import type { DetectorSpectrum } from "../../types/spectrum";

interface DetectorSelectorProps {
  label: string;
  description: string;
  detectors: DetectorSpectrum[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function DetectorSelector({
  label,
  description,
  detectors,
  value,
  onChange,
}: DetectorSelectorProps) {
  return (
    <Select
      label={label}
      description={description}
      data={detectors.map((detector) => ({
        value: detector.detectorId,
        label: detector.name,
      }))}
      value={value}
      onChange={onChange}
      searchable
      allowDeselect={false}
      placeholder="Выберите детектор"
      nothingFoundMessage="Нет детекторов"
    />
  );
}
