import type {
  AggregatedSpectrum,
  ProcessedSpectrum,
  PreprocessingSettings,
} from "../../types/spectrum";

export function ensureOddWindow(value: number, minimum = 3) {
  const normalized = Math.max(minimum, Math.round(value));
  return normalized % 2 === 0 ? normalized + 1 : normalized;
}

export function movingAverage(signal: number[], window: number) {
  const normalizedWindow = ensureOddWindow(window);
  const halfWindow = Math.floor(normalizedWindow / 2);

  return signal.map((_, index) => {
    let sum = 0;
    let count = 0;

    for (
      let cursor = Math.max(0, index - halfWindow);
      cursor <= Math.min(signal.length - 1, index + halfWindow);
      cursor += 1
    ) {
      sum += signal[cursor];
      count += 1;
    }

    return count > 0 ? sum / count : 0;
  });
}

export function rollingMinimum(signal: number[], window: number) {
  const normalizedWindow = ensureOddWindow(window);
  const halfWindow = Math.floor(normalizedWindow / 2);

  return signal.map((_, index) => {
    let minimum = Number.POSITIVE_INFINITY;

    for (
      let cursor = Math.max(0, index - halfWindow);
      cursor <= Math.min(signal.length - 1, index + halfWindow);
      cursor += 1
    ) {
      minimum = Math.min(minimum, signal[cursor]);
    }

    return Number.isFinite(minimum) ? minimum : 0;
  });
}

export function normalizeSignal(signal: number[], mode: PreprocessingSettings["normalizationMode"]) {
  if (mode === "none") {
    return [...signal];
  }

  const sum = signal.reduce((accumulator, value) => accumulator + value, 0);

  if (sum <= 0) {
    return [...signal];
  }

  return signal.map((value) => value / sum);
}

export function preprocessSpectrum(
  aggregated: AggregatedSpectrum,
  settings: PreprocessingSettings,
): ProcessedSpectrum {
  const smoothingWindow = ensureOddWindow(settings.smoothingWindow);
  const baselineWindow = ensureOddWindow(settings.baselineWindow);
  const smoothed = movingAverage(aggregated.channels, smoothingWindow);
  const baselineSeed = rollingMinimum(smoothed, baselineWindow);
  const baseline = movingAverage(
    baselineSeed,
    Math.max(3, ensureOddWindow(Math.floor(baselineWindow / 8))),
  );
  const corrected = smoothed.map((value, index) => {
    if (!settings.useBaselineCorrection) {
      return value;
    }

    return Math.max(0, value - baseline[index]);
  });

  return {
    raw: [...aggregated.channels],
    smoothed,
    baseline,
    corrected,
    normalized: normalizeSignal(corrected, settings.normalizationMode),
  };
}
