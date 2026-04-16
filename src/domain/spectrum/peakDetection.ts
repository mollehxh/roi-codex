import { energyFromChannel } from "../../shared/spc/parseSpcFile";
import type {
  Peak,
  PeakDetectionSettings,
  ProcessedSpectrum,
} from "../../types/spectrum";

interface PeakCandidate {
  channel: number;
  value: number;
  prominence: number;
  widthHint: number;
}

function applyDerivative(signal: number[], window: number) {
  const derivativeWindow = Math.max(1, Math.round(window));
  const result = new Array<number>(signal.length).fill(0);

  for (let index = derivativeWindow; index < signal.length - derivativeWindow; index += 1) {
    let left = 0;
    let right = 0;

    for (let cursor = 0; cursor < derivativeWindow; cursor += 1) {
      left += signal[index - cursor - 1];
      right += signal[index + cursor + 1];
    }

    left /= derivativeWindow;
    right /= derivativeWindow;
    result[index] = (right - left) / (derivativeWindow + 1);
  }

  for (let index = 0; index < derivativeWindow; index += 1) {
    result[index] = (signal[Math.min(signal.length - 1, index + 1)] - signal[index]) / 2;
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
  const halfHeight = signal[index] * 0.5;
  let left = index;
  let right = index;

  while (left > 0 && signal[left] >= halfHeight) {
    left -= 1;
  }

  while (right < signal.length - 1 && signal[right] >= halfHeight) {
    right += 1;
  }

  return Math.max(4, Math.min(defaultRadius, Math.max(fromResolution, right - left)));
}

function estimateProminence(signal: number[], index: number, radius: number) {
  const leftBound = Math.max(0, index - radius);
  const rightBound = Math.min(signal.length - 1, index + radius);
  let leftMinimum = signal[index];
  let rightMinimum = signal[index];

  for (let cursor = leftBound; cursor <= index; cursor += 1) {
    leftMinimum = Math.min(leftMinimum, signal[cursor]);
  }

  for (let cursor = index; cursor <= rightBound; cursor += 1) {
    rightMinimum = Math.min(rightMinimum, signal[cursor]);
  }

  return signal[index] - Math.max(leftMinimum, rightMinimum);
}

function refinePeakChannel(
  signal: number[],
  candidateChannel: number,
  settings: PeakDetectionSettings,
) {
  const localLeft = Math.max(0, candidateChannel - settings.refinementRadius);
  const localRight = Math.min(signal.length - 1, candidateChannel + settings.refinementRadius);
  let roughPeak = candidateChannel;

  for (let index = localLeft; index <= localRight; index += 1) {
    if (signal[index] > signal[roughPeak]) {
      roughPeak = index;
    }
  }

  let derivativeWindow = adaptiveDerivativeWindow(roughPeak);
  const widthHint = estimateWidthHint(
    signal,
    roughPeak,
    settings.refinementRadius * 3,
    settings.detectorResolutionPercent,
  );

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const firstDerivative = applyDerivative(signal, derivativeWindow);
    const secondDerivative = applyDerivative(firstDerivative, derivativeWindow);
    const searchLeft = Math.max(1, roughPeak - widthHint);
    const searchRight = Math.min(signal.length - 2, roughPeak + widthHint);
    const crossings: number[] = [];

    for (let index = searchLeft; index <= searchRight; index += 1) {
      const current = secondDerivative[index];
      const next = secondDerivative[index + 1];

      if (current === 0 || current * next < 0) {
        const crossing =
          current === next ? index : index + current / (current - next);
        crossings.push(crossing);
      }
    }

    const leftCrossing = [...crossings]
      .filter((crossing) => crossing < roughPeak)
      .sort((left, right) => right - left)[0];
    const rightCrossing = [...crossings]
      .filter((crossing) => crossing > roughPeak)
      .sort((left, right) => left - right)[0];

    if (
      leftCrossing !== undefined &&
      rightCrossing !== undefined &&
      crossings.length >= 2 &&
      crossings.length <= 4
    ) {
      return {
        refinedChannel: (leftCrossing + rightCrossing) / 2,
        widthHint,
      };
    }

    derivativeWindow += 1;
  }

  return {
    refinedChannel: roughPeak,
    widthHint,
  };
}

export function detectPeaks(
  processed: ProcessedSpectrum,
  settings: PeakDetectionSettings,
  calibration: { slope: number; intercept: number },
): Peak[] {
  const signal = processed.normalized;
  const refinementSignal = processed.corrected;
  const maxValue = Math.max(...signal, 0);
  const candidates: PeakCandidate[] = [];
  const searchMargin = Math.max(4, Math.floor(settings.minDistance / 2));

  for (
    let index = searchMargin;
    index < signal.length - 1 - searchMargin;
    index += 1
  ) {
    const value = signal[index];

    if (value <= signal[index - 1] || value <= signal[index + 1]) {
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
      value: refinementSignal[index],
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

  return deduplicatedPeaks.map((candidate, index) => ({
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
  }));
}
