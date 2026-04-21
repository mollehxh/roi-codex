import { energyFromChannel } from "../../shared/spc/parseSpcFile";
import type {
  EnergyCalibration,
  Peak,
  PeakSelectionMode,
  PeakDetectionSettings,
  ProcessedSpectrum,
} from "../../types/spectrum";

interface AutoPeakDetectionResult {
  calibration: EnergyCalibration;
  peaks: Peak[];
}

interface PeakCandidate {
  channel: number;
  value: number;
  prominence: number;
  widthHint: number;
}

const MAX_REFINEMENT_ATTEMPTS = 6;

function applyDerivative(signal: number[], window: number) {
  const derivativeWindow = Math.max(1, Math.round(window));
  const result = new Array<number>(signal.length).fill(0);

  for (let index = derivativeWindow; index <= signal.length - 1 - derivativeWindow; index += 1) {
    let left = 0;
    let right = 0;

    for (let cursor = 0; cursor <= derivativeWindow - 1; cursor += 1) {
      left += signal[index - cursor - 1];
      right += signal[index + cursor + 1];
    }

    left /= derivativeWindow;
    right /= derivativeWindow;
    result[index] = (right - left) / (derivativeWindow + 1);
  }

  for (let index = 0; index <= derivativeWindow - 1 && index < signal.length - 1; index += 1) {
    result[index] = (signal[index + 1] - signal[index]) / 2;
  }

  for (
    let index = Math.max(derivativeWindow, signal.length - derivativeWindow);
    index < signal.length;
    index += 1
  ) {
    result[index] = (signal[index] - signal[Math.max(0, index - 1)]) / 2;
  }

  return result;
}

function adaptiveDerivativeWindow(channel: number) {
  const rounded = Math.max(1, Math.round(channel));
  return Math.max(
    1,
    Math.round(
      0.000000046 * rounded * rounded * rounded -
        0.0000454 * rounded * rounded +
        0.014298293 * rounded +
        2.571662206,
    ),
  );
}

function estimateSearchHalfRange(channel: number, detectorResolutionPercent: number) {
  const safeChannel = Math.max(1, Math.round(channel));
  const scaledResolution =
    detectorResolutionPercent * Math.sqrt(175.0 / safeChannel);

  return Math.max(
    1,
    Math.round((scaledResolution / 100.0) * safeChannel / 2.0),
  );
}

function estimateProminence(signal: number[], index: number, radius: number) {
  const leftBound = Math.max(0, index - radius);
  const rightBound = Math.min(signal.length - 1, index + radius);
  let leftMinimum = signal[index] ?? 0;
  let rightMinimum = signal[index] ?? 0;

  for (let cursor = leftBound; cursor <= index; cursor += 1) {
    leftMinimum = Math.min(leftMinimum, signal[cursor] ?? leftMinimum);
  }

  for (let cursor = index; cursor <= rightBound; cursor += 1) {
    rightMinimum = Math.min(rightMinimum, signal[cursor] ?? rightMinimum);
  }

  return (signal[index] ?? 0) - Math.max(leftMinimum, rightMinimum);
}

function estimateWidthHint(
  signal: number[],
  index: number,
  defaultRadius: number,
  detectorResolutionPercent: number,
) {
  const channel = Math.max(1, index);
  const fromResolution = Math.round(
    (detectorResolutionPercent * Math.sqrt(175 / channel) * channel) / 200,
  );
  const halfHeight = (signal[index] ?? 0) * 0.5;
  let left = index;
  let right = index;

  while (left > 0 && (signal[left] ?? 0) >= halfHeight) {
    left -= 1;
  }

  while (right < signal.length - 1 && (signal[right] ?? 0) >= halfHeight) {
    right += 1;
  }

  return Math.max(4, Math.min(defaultRadius, Math.max(fromResolution, right - left)));
}

function peakPositionExact(
  signal: number[],
  approximateChannel: number,
  detectorResolutionPercent: number,
  searchHalfRange: number,
) {
  if (approximateChannel < 1 || approximateChannel > signal.length - 2) {
    return -1;
  }

  let halfSearch = Math.max(1, searchHalfRange);
  let derivativeWindow = adaptiveDerivativeWindow(approximateChannel);
  let peakChannel = approximateChannel;
  let maximum = 0;

  for (let index = approximateChannel - halfSearch; index <= approximateChannel + halfSearch; index += 1) {
    const safeIndex = Math.max(0, Math.min(signal.length - 1, index));
    if ((signal[safeIndex] ?? 0) > maximum) {
      maximum = signal[safeIndex] ?? 0;
      peakChannel = safeIndex;
    }
  }

  const scaledResolution =
    detectorResolutionPercent * Math.sqrt(175.0 / Math.max(1, peakChannel));
  halfSearch = Math.max(
    1,
    Math.round((scaledResolution / 100.0) * peakChannel / 2.0),
  );

  let secondDerivative = [...signal];
  let crossingsCount = 0;
  let attempts = 0;

  do {
    secondDerivative = applyDerivative(applyDerivative(signal, derivativeWindow), derivativeWindow);
    crossingsCount = -1;

    for (let index = peakChannel - halfSearch; index <= peakChannel + halfSearch; index += 1) {
      const safeIndex = Math.max(0, Math.min(signal.length - 2, index));
      if ((secondDerivative[safeIndex] ?? 0) * (secondDerivative[safeIndex + 1] ?? 0) < 0) {
        crossingsCount += 1;
      }
    }

    derivativeWindow += 1;
    attempts += 1;

    if (attempts === MAX_REFINEMENT_ATTEMPTS && crossingsCount > 1) {
      return -1;
    }
  } while (crossingsCount > 1 && attempts < MAX_REFINEMENT_ATTEMPTS);

  let leftIndex = peakChannel - 1;
  const leftLimit =
    peakChannel - 1 - (scaledResolution / 100.0) * peakChannel / 2.355 * 3;

  while (
    leftIndex > 0 &&
    (secondDerivative[leftIndex] ?? 0) * (secondDerivative[leftIndex + 1] ?? 0) > 0
  ) {
    leftIndex -= 1;
    if (leftIndex < leftLimit) {
      return -1;
    }
  }

  const leftPoint =
    secondDerivative[leftIndex] === secondDerivative[leftIndex + 1]
      ? leftIndex
      : leftIndex +
        (secondDerivative[leftIndex] ?? 0) /
          ((secondDerivative[leftIndex] ?? 0) - (secondDerivative[leftIndex + 1] ?? 0));

  let rightIndex = peakChannel + 1;
  const rightLimit =
    peakChannel + 1 + (scaledResolution / 100.0) * peakChannel / 2.355 * 3;

  while (
    rightIndex < signal.length - 1 &&
    (secondDerivative[rightIndex - 1] ?? 0) * (secondDerivative[rightIndex] ?? 0) > 0
  ) {
    rightIndex += 1;
    if (rightIndex > rightLimit || rightIndex >= signal.length - 1) {
      return -1;
    }
  }

  const rightPoint =
    secondDerivative[rightIndex] === secondDerivative[rightIndex - 1]
      ? rightIndex
      : rightIndex -
        1.0 +
        (secondDerivative[rightIndex - 1] ?? 0) /
          ((secondDerivative[rightIndex - 1] ?? 0) - (secondDerivative[rightIndex] ?? 0));

  return (rightPoint + leftPoint) / 2;
}

function refinePeakChannel(
  signal: number[],
  candidateChannel: number,
  settings: PeakDetectionSettings,
) {
  const widthHint = estimateWidthHint(
    signal,
    candidateChannel,
    settings.refinementRadius * 3,
    settings.detectorResolutionPercent,
  );
  const refinedChannel = peakPositionExact(
    signal,
    candidateChannel,
    settings.detectorResolutionPercent,
    Math.max(
      settings.refinementRadius,
      estimateSearchHalfRange(candidateChannel, settings.detectorResolutionPercent),
    ),
  );

  return {
    refinedChannel: refinedChannel > 0 ? refinedChannel : candidateChannel,
    widthHint,
  };
}

export function detectPeaks(
  processed: ProcessedSpectrum,
  settings: PeakDetectionSettings,
  calibration: EnergyCalibration,
): AutoPeakDetectionResult {
  const signal = processed.normalized;
  const refinementSignal = processed.raw;
  const maxValue = Math.max(...signal, 0);
  const candidates: PeakCandidate[] = [];
  const searchMargin = Math.max(4, Math.floor(settings.minDistance / 2));

  for (
    let index = searchMargin;
    index < signal.length - 1 - searchMargin;
    index += 1
  ) {
    const value = signal[index] ?? 0;

    if (value <= (signal[index - 1] ?? value) || value <= (signal[index + 1] ?? value)) {
      continue;
    }

    if (value < maxValue * settings.minHeightRatio) {
      continue;
    }

    const prominence = estimateProminence(signal, index, settings.refinementRadius * 2);

    if (prominence < settings.minProminence) {
      continue;
    }

    candidates.push({
      channel: index,
      value: refinementSignal[index] ?? 0,
      prominence,
      widthHint: estimateWidthHint(
        refinementSignal,
        index,
        settings.refinementRadius * 3,
        settings.detectorResolutionPercent,
      ),
    });
  }

  const selectedCandidates = [...candidates]
    .sort((left, right) => right.value - left.value)
    .filter((candidate, index, source) => {
      for (let cursor = 0; cursor < index; cursor += 1) {
        const selected = source[cursor];

        if (Math.abs(selected.channel - candidate.channel) < settings.minDistance) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => left.channel - right.channel);

  const refinedPeaks = selectedCandidates.map((candidate) => {
    const refined = refinePeakChannel(refinementSignal, candidate.channel, settings);
    return {
      channel: candidate.channel,
      refinedChannel: refined.refinedChannel,
      value: candidate.value,
      prominence: candidate.prominence,
      widthHint: refined.widthHint,
    };
  });

  const deduplicatedPeaks = refinedPeaks
    .sort((left, right) => right.prominence - left.prominence)
    .filter((candidate, index, source) => {
      for (let cursor = 0; cursor < index; cursor += 1) {
        const selected = source[cursor];
        const refinedDistance = Math.abs(
          selected.refinedChannel - candidate.refinedChannel,
        );
        const allowedDistance = Math.max(
          2,
          Math.min(settings.minDistance, Math.round(candidate.widthHint / 2)),
        );

        if (refinedDistance <= allowedDistance) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => left.refinedChannel - right.refinedChannel);

  return {
    calibration,
    peaks: deduplicatedPeaks.map((candidate, index) => ({
      id: `peak-${index + 1}`,
      channel: candidate.channel,
      refinedChannel: candidate.refinedChannel,
      value: candidate.value,
      prominence: candidate.prominence,
      widthHint: candidate.widthHint,
      energy: energyFromChannel(
        candidate.refinedChannel,
        calibration.slope,
        calibration.intercept,
      ),
      source: "auto",
    })),
  };
}

export function buildPeaksFromChannels(
  processed: ProcessedSpectrum,
  channels: number[],
  settings: PeakDetectionSettings,
  calibration: EnergyCalibration,
  source: PeakSelectionMode,
): Peak[] {
  const signal = processed.normalized;
  const refinementSignal = processed.raw;
  const uniqueChannels = [...new Set(channels.map((channel) => Math.round(channel)))]
    .filter((channel) => channel >= 0 && channel < signal.length)
    .sort((left, right) => left - right);

  return uniqueChannels.map((channel, index) => {
    const prominence = estimateProminence(signal, channel, settings.refinementRadius * 2);
    const refined = refinePeakChannel(refinementSignal, channel, settings);

    return {
      id: `peak-${index + 1}`,
      channel,
      refinedChannel: refined.refinedChannel,
      value: refinementSignal[channel] ?? 0,
      prominence,
      widthHint: refined.widthHint,
      energy: energyFromChannel(
        refined.refinedChannel,
        calibration.slope,
        calibration.intercept,
      ),
      source,
    };
  });
}
