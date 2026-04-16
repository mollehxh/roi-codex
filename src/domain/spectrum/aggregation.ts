import type {
  AggregatedSpectrum,
  AggregationMode,
  DetectorSpectrum,
} from "../../types/spectrum";

export function aggregateDetectors(
  detectors: DetectorSpectrum[],
  selectedDetectorIds: string[],
  mode: AggregationMode,
): AggregatedSpectrum {
  const selected = detectors.filter((detector) =>
    selectedDetectorIds.includes(detector.detectorId),
  );

  if (selected.length === 0) {
    throw new Error("Выберите хотя бы один детектор.");
  }

  const channelCount = selected[0].channels.length;
  const aggregated = new Array<number>(channelCount).fill(0);

  for (const detector of selected) {
    for (let index = 0; index < channelCount; index += 1) {
      aggregated[index] += detector.channels[index] ?? 0;
    }
  }

  if (mode === "mean") {
    for (let index = 0; index < channelCount; index += 1) {
      aggregated[index] /= selected.length;
    }
  }

  const slope =
    selected.reduce((sum, detector) => sum + detector.calibration.slope, 0) /
    selected.length;
  const intercept =
    selected.reduce((sum, detector) => sum + detector.calibration.intercept, 0) /
    selected.length;

  return {
    detectorIds: selected.map((detector) => detector.detectorId),
    mode,
    channels: aggregated,
    calibration: {
      slope,
      intercept,
    },
  };
}
