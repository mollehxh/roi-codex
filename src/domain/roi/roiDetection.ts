import type {
  InformationMetric,
  Peak,
  ProcessedSpectrum,
  ROI,
  RoiDetectionSettings,
} from "../../types/spectrum";

interface RoiMetrics {
  klScore: number;
  fisherScore: number;
  score: number;
}

const EPSILON = 1e-9;

function normalizeSegment(segment: number[]) {
  const safeSegment = segment.map((value) => Math.max(value, 0) + EPSILON);
  const sum = safeSegment.reduce(
    (accumulator, value) => accumulator + value,
    0,
  );

  if (sum <= 0) {
    return safeSegment.map(() => 1 / safeSegment.length);
  }

  return safeSegment.map((value) => value / sum);
}

function computeKlDivergence(signal: number[], baseline: number[]) {
  const normalizedSignal = normalizeSegment(signal);
  const normalizedBaseline = normalizeSegment(baseline);

  return normalizedSignal.reduce((accumulator, value, index) => {
    return accumulator + value * Math.log(value / normalizedBaseline[index]);
  }, 0);
}

function computeFisherInformation(signal: number[]) {
  const normalizedSignal = normalizeSegment(signal);

  if (normalizedSignal.length < 2) {
    return 0;
  }

  let fisher = 0;

  for (let index = 1; index < normalizedSignal.length; index += 1) {
    const delta = normalizedSignal[index] - normalizedSignal[index - 1];
    fisher += (delta * delta) / Math.max(normalizedSignal[index], EPSILON);
  }

  return fisher / (normalizedSignal.length - 1);
}

function evaluateRoi(
  processed: ProcessedSpectrum,
  startChannel: number,
  endChannel: number,
  settings: RoiDetectionSettings,
): RoiMetrics {
  const correctedSlice = processed.corrected.slice(
    startChannel,
    endChannel + 1,
  );
  const baselineSlice = processed.baseline.slice(startChannel, endChannel + 1);
  const klScore = computeKlDivergence(correctedSlice, baselineSlice);
  const fisherScore = computeFisherInformation(correctedSlice);
  const score =
    settings.scoreWeights.kl * klScore +
    settings.scoreWeights.fisher * fisherScore;

  return {
    klScore,
    fisherScore,
    score,
  };
}

function padRoiWidth(
  startChannel: number,
  endChannel: number,
  peakChannel: number,
  minChannel: number,
  maxChannel: number,
  minimumWidth: number,
) {
  let start = startChannel;
  let end = endChannel;

  while (end - start + 1 < minimumWidth) {
    const canGrowLeft = start > minChannel;
    const canGrowRight = end < maxChannel;

    if (!canGrowLeft && !canGrowRight) {
      break;
    }

    if (
      canGrowLeft &&
      (!canGrowRight || peakChannel - start <= end - peakChannel)
    ) {
      start -= 1;
      continue;
    }

    if (canGrowRight) {
      end += 1;
    }
  }

  return { start, end };
}

function getPeakBounds(peaks: Peak[], index: number, signalLength: number) {
  const currentPeak = Math.round(peaks[index].refinedChannel);
  const previousPeak =
    index > 0 ? Math.round(peaks[index - 1].refinedChannel) : null;
  const nextPeak =
    index < peaks.length - 1
      ? Math.round(peaks[index + 1].refinedChannel)
      : null;

  return {
    leftLimit:
      previousPeak === null
        ? 0
        : Math.floor((previousPeak + currentPeak) / 2) + 1,
    rightLimit:
      nextPeak === null
        ? signalLength - 1
        : Math.ceil((currentPeak + nextPeak) / 2) - 1,
  };
}

function findDirectionalValley(
  signal: number[],
  peakChannel: number,
  limit: number,
  direction: -1 | 1,
) {
  let cursor = peakChannel;
  let minimumIndex = peakChannel;
  let minimumValue = signal[peakChannel] ?? 0;
  const peakValue = Math.max(signal[peakChannel] ?? 0, EPSILON);
  let riseSteps = 0;

  while (cursor !== limit) {
    cursor += direction;
    const value = signal[cursor] ?? 0;

    if (value <= minimumValue + EPSILON) {
      minimumValue = value;
      minimumIndex = cursor;
      riseSteps = 0;
      continue;
    }

    riseSteps += 1;

    if (
      riseSteps >= 4 &&
      minimumValue <= peakValue * 0.35 &&
      value > minimumValue * 1.2 + 0.01
    ) {
      return minimumIndex;
    }
  }

  return minimumIndex;
}

function buildLocalWindow(
  peaks: Peak[],
  processed: ProcessedSpectrum,
  index: number,
  settings: RoiDetectionSettings,
) {
  const peak = peaks[index];
  const signalLength = processed.corrected.length;
  const peakChannel = Math.round(peak.refinedChannel);
  const { leftLimit, rightLimit } = getPeakBounds(peaks, index, signalLength);
  const maxHalfWidth = Math.max(
    settings.minRoiWidth,
    Math.min(
      settings.maxExpansion,
      Math.round(Math.max(peak.widthHint, 4) * 4.5),
    ),
  );

  const leftSearchLimit = Math.max(leftLimit, peakChannel - maxHalfWidth);
  const rightSearchLimit = Math.min(rightLimit, peakChannel + maxHalfWidth);
  const leftValley = findDirectionalValley(
    processed.corrected,
    peakChannel,
    leftSearchLimit,
    -1,
  );
  const rightValley = findDirectionalValley(
    processed.corrected,
    peakChannel,
    rightSearchLimit,
    1,
  );

  return {
    peakChannel,
    minChannel: Math.max(leftLimit, leftValley),
    maxChannel: Math.min(rightLimit, rightValley),
    maxHalfWidth,
  };
}

function normalizeWindowSize(value: number) {
  return Math.max(3, Math.min(5, Math.round(value)));
}

function averageRange(
  values: number[],
  startChannel: number,
  endChannel: number,
) {
  let sum = 0;
  let count = 0;

  for (let channel = startChannel; channel <= endChannel; channel += 1) {
    sum += Math.max(0, values[channel] ?? 0);
    count += 1;
  }

  return count > 0 ? sum / count : 0;
}

function averageCenteredWindow(
  values: number[],
  centerChannel: number,
  windowSize: number,
  minChannel: number,
  maxChannel: number,
) {
  const leftSize = Math.floor((windowSize - 1) / 2);
  const rightSize = windowSize - 1 - leftSize;
  const startChannel = Math.max(minChannel, centerChannel - leftSize);
  const endChannel = Math.min(maxChannel, centerChannel + rightSize);

  return averageRange(values, startChannel, endChannel);
}

function averageDirectionalWindow(
  values: number[],
  edgeChannel: number,
  direction: -1 | 1,
  windowSize: number,
  minChannel: number,
  maxChannel: number,
) {
  const startChannel =
    direction === -1
      ? Math.max(minChannel, edgeChannel - windowSize + 1)
      : edgeChannel;
  const endChannel =
    direction === -1
      ? edgeChannel
      : Math.min(maxChannel, edgeChannel + windowSize - 1);

  return averageRange(values, startChannel, endChannel);
}

function expandInformationBoundary(
  peakChannel: number,
  direction: -1 | 1,
  localWindow: ReturnType<typeof buildLocalWindow>,
  processed: ProcessedSpectrum,
  infoPerChannel: number[],
  settings: RoiDetectionSettings,
) {
  const windowSize = normalizeWindowSize(settings.growthStabilityWindow);
  const peakInfoAverage = Math.max(
    averageCenteredWindow(
      infoPerChannel,
      peakChannel,
      windowSize,
      localWindow.minChannel,
      localWindow.maxChannel,
    ),
    infoPerChannel[peakChannel] ?? 0,
    EPSILON,
  );
  const peakSignalAverage = Math.max(
    averageCenteredWindow(
      processed.corrected,
      peakChannel,
      windowSize,
      localWindow.minChannel,
      localWindow.maxChannel,
    ),
    processed.corrected[peakChannel] ?? 0,
    EPSILON,
  );
  const infoThreshold =
    peakInfoAverage *
    Math.max(
      settings.growthStabilityThreshold,
      settings.relativeInfoGrowthThreshold,
    );
  const backgroundSignalThreshold =
    peakSignalAverage * Math.max(0.06, settings.growthStabilityThreshold * 4);
  const allowedWeakSteps = Math.max(1, settings.maxWeakSteps);
  const maxDirectionalSteps = Math.min(
    settings.maxGrowthSteps,
    localWindow.maxHalfWidth,
  );

  let cursor = peakChannel;
  let lastUsefulChannel = peakChannel;
  let weakSteps = 0;
  let stepCount = 0;

  while (stepCount < maxDirectionalSteps) {
    const nextChannel = cursor + direction;

    if (
      nextChannel < localWindow.minChannel ||
      nextChannel > localWindow.maxChannel
    ) {
      break;
    }

    const infoAverage = averageDirectionalWindow(
      infoPerChannel,
      nextChannel,
      direction,
      windowSize,
      localWindow.minChannel,
      localWindow.maxChannel,
    );
    const signalAverage = averageDirectionalWindow(
      processed.corrected,
      nextChannel,
      direction,
      windowSize,
      localWindow.minChannel,
      localWindow.maxChannel,
    );
    const weakInformation = infoAverage < infoThreshold;
    const declineToBackground =
      signalAverage <= backgroundSignalThreshold &&
      infoAverage < peakInfoAverage * 0.15;

    if (declineToBackground) {
      break;
    }

    if (weakInformation) {
      weakSteps += 1;

      if (weakSteps > allowedWeakSteps) {
        break;
      }
    } else {
      weakSteps = 0;
      lastUsefulChannel = nextChannel;
    }

    cursor = nextChannel;
    stepCount += 1;
  }

  return lastUsefulChannel;
}

function growByInformation(
  peak: Peak,
  peaks: Peak[],
  processed: ProcessedSpectrum,
  infoPerChannel: number[],
  totalInformation: number,
  settings: RoiDetectionSettings,
  index: number,
): ROI {
  const localWindow = buildLocalWindow(peaks, processed, index, settings);
  localWindow.minChannel = Math.max(
    localWindow.minChannel,
    settings.minChannel,
  );
  localWindow.maxChannel = Math.min(
    localWindow.maxChannel,
    settings.maxChannel,
  );
  const leftBoundary = expandInformationBoundary(
    localWindow.peakChannel,
    -1,
    localWindow,
    processed,
    infoPerChannel,
    settings,
  );
  const rightBoundary = expandInformationBoundary(
    localWindow.peakChannel,
    1,
    localWindow,
    processed,
    infoPerChannel,
    settings,
  );

  const padded = padRoiWidth(
    leftBoundary,
    rightBoundary,
    localWindow.peakChannel,
    localWindow.minChannel,
    localWindow.maxChannel,
    settings.minRoiWidth,
  );
  const metrics = evaluateRoi(processed, padded.start, padded.end, settings);
  const roiInformation = infoPerChannel
    .slice(padded.start, padded.end + 1)
    .reduce((sum, value) => sum + value, 0);

  return {
    id: `roi-${index + 1}`,
    startChannel: padded.start,
    endChannel: padded.end,
    peakChannel: peak.refinedChannel,
    width: padded.end - padded.start + 1,
    score: metrics.score,
    klScore: metrics.klScore,
    fisherScore: metrics.fisherScore,
    information: roiInformation,
    informationFraction:
      totalInformation > 0 ? roiInformation / totalInformation : 0,
    detectorIds: [],
    peakId: peak.id,
  };
}

function growByLocalScore(
  peak: Peak,
  peaks: Peak[],
  processed: ProcessedSpectrum,
  settings: RoiDetectionSettings,
  index: number,
): ROI {
  const localWindow = buildLocalWindow(peaks, processed, index, settings);
  const peakSignal = Math.max(
    processed.corrected[localWindow.peakChannel] ?? 0,
    EPSILON,
  );
  const seedHalfWidth = Math.max(
    2,
    Math.min(
      Math.round(Math.max(peak.widthHint, settings.minRoiWidth) / 2),
      Math.floor((localWindow.maxChannel - localWindow.minChannel) / 2),
    ),
  );

  let startChannel = Math.max(
    localWindow.minChannel,
    localWindow.peakChannel - seedHalfWidth,
  );
  let endChannel = Math.min(
    localWindow.maxChannel,
    localWindow.peakChannel + seedHalfWidth,
  );
  let currentMetrics = evaluateRoi(
    processed,
    startChannel,
    endChannel,
    settings,
  );
  let weakSteps = 0;
  let stepCount = 0;
  const allowedWeakSteps = Math.max(settings.maxWeakSteps + 2, 3);

  while (
    stepCount < settings.maxGrowthSteps &&
    (startChannel > localWindow.minChannel ||
      endChannel < localWindow.maxChannel)
  ) {
    const proposals: Array<{
      start: number;
      end: number;
      metrics: RoiMetrics;
      delta: number;
      edgeSignal: number;
    }> = [];

    if (startChannel > localWindow.minChannel) {
      const nextStart = startChannel - 1;
      const metrics = evaluateRoi(processed, nextStart, endChannel, settings);
      proposals.push({
        start: nextStart,
        end: endChannel,
        metrics,
        delta: metrics.score - currentMetrics.score,
        edgeSignal: processed.corrected[nextStart] ?? 0,
      });
    }

    if (endChannel < localWindow.maxChannel) {
      const nextEnd = endChannel + 1;
      const metrics = evaluateRoi(processed, startChannel, nextEnd, settings);
      proposals.push({
        start: startChannel,
        end: nextEnd,
        metrics,
        delta: metrics.score - currentMetrics.score,
        edgeSignal: processed.corrected[nextEnd] ?? 0,
      });
    }

    if (proposals.length === 0) {
      break;
    }

    proposals.sort((left, right) => right.delta - left.delta);
    const proposal = proposals[0];
    const currentWidth = endChannel - startChannel + 1;
    const signalRatio = proposal.edgeSignal / peakSignal;
    const weakGrowth =
      (proposal.delta <= EPSILON &&
        signalRatio < 0.12 &&
        proposal.metrics.klScore <
          currentMetrics.klScore * (1 - settings.degradationTolerance * 0.5)) ||
      proposal.edgeSignal <= EPSILON;

    if (weakGrowth) {
      weakSteps += 1;
      if (weakSteps > allowedWeakSteps) {
        break;
      }
    } else {
      weakSteps = 0;
    }

    if (currentWidth >= localWindow.maxHalfWidth * 2 + 1) {
      break;
    }

    startChannel = proposal.start;
    endChannel = proposal.end;
    currentMetrics = proposal.metrics;
    stepCount += 1;
  }

  const padded = padRoiWidth(
    startChannel,
    endChannel,
    localWindow.peakChannel,
    localWindow.minChannel,
    localWindow.maxChannel,
    settings.minRoiWidth,
  );
  const metrics = evaluateRoi(processed, padded.start, padded.end, settings);

  return {
    id: `roi-${index + 1}`,
    startChannel: padded.start,
    endChannel: padded.end,
    peakChannel: peak.refinedChannel,
    width: padded.end - padded.start + 1,
    score: metrics.score,
    klScore: metrics.klScore,
    fisherScore: metrics.fisherScore,
    information: 0,
    informationFraction: 0,
    detectorIds: [],
    peakId: peak.id,
  };
}

function splitOverlappingRois(rois: ROI[]) {
  const result = rois
    .map((roi) => ({ ...roi }))
    .sort((left, right) => left.peakChannel - right.peakChannel);

  for (let index = 0; index < result.length - 1; index += 1) {
    const current = result[index];
    const next = result[index + 1];

    if (current.endChannel < next.startChannel) {
      continue;
    }

    const midpoint = Math.floor((current.peakChannel + next.peakChannel) / 2);
    current.endChannel = Math.min(current.endChannel, midpoint);
    next.startChannel = Math.max(next.startChannel, midpoint + 1);
    current.width = current.endChannel - current.startChannel + 1;
    next.width = next.endChannel - next.startChannel + 1;
  }

  return result.filter((roi) => roi.startChannel <= roi.endChannel);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shouldMergeGap(
  left: ROI,
  right: ROI,
  processed: ProcessedSpectrum,
  infoPerChannel: number[] | null,
) {
  const gapStart = left.endChannel + 1;
  const gapEnd = right.startChannel - 1;

  if (gapStart > gapEnd) {
    return true;
  }

  const gapWidth = gapEnd - gapStart + 1;
  const maxAllowedGap = Math.max(
    6,
    Math.min(24, Math.round(Math.min(left.width, right.width) * 0.8)),
  );

  if (gapWidth > maxAllowedGap) {
    return false;
  }

  const gapSignal = processed.corrected.slice(gapStart, gapEnd + 1);
  const leftSignal = processed.corrected.slice(
    left.startChannel,
    left.endChannel + 1,
  );
  const rightSignal = processed.corrected.slice(
    right.startChannel,
    right.endChannel + 1,
  );
  const gapPeak = Math.max(...gapSignal, 0);
  const gapMean = average(gapSignal);
  const referencePeak = Math.min(
    Math.max(...leftSignal, 0),
    Math.max(...rightSignal, 0),
  );

  if (referencePeak <= EPSILON) {
    return false;
  }

  const shallowValley =
    gapPeak >= referencePeak * 0.22 && gapMean >= referencePeak * 0.12;

  if (!infoPerChannel) {
    return shallowValley;
  }

  const gapInfo = infoPerChannel
    .slice(gapStart, gapEnd + 1)
    .reduce((sum, value) => sum + value, 0);
  const leftInfo = infoPerChannel
    .slice(left.startChannel, left.endChannel + 1)
    .reduce((sum, value) => sum + value, 0);
  const rightInfo = infoPerChannel
    .slice(right.startChannel, right.endChannel + 1)
    .reduce((sum, value) => sum + value, 0);
  const averageSideInfo = average([leftInfo, rightInfo]);
  const informativeGap = gapInfo >= averageSideInfo * 0.12;

  return shallowValley || informativeGap;
}

function mergeAdjacentRois(
  rois: ROI[],
  processed: ProcessedSpectrum,
  infoPerChannel: number[] | null,
) {
  if (rois.length < 2) {
    return rois;
  }

  const merged: ROI[] = [];

  for (const roi of rois) {
    const previous = merged.length > 0 ? merged[merged.length - 1] : null;

    if (!previous) {
      merged.push({ ...roi });
      continue;
    }

    if (!shouldMergeGap(previous, roi, processed, infoPerChannel)) {
      merged.push({ ...roi });
      continue;
    }

    previous.endChannel = roi.endChannel;
    previous.width = previous.endChannel - previous.startChannel + 1;
    previous.information += roi.information;
    previous.informationFraction += roi.informationFraction;
    previous.score = Math.max(previous.score, roi.score);
    previous.klScore = Math.max(previous.klScore, roi.klScore);
    previous.fisherScore = Math.max(previous.fisherScore, roi.fisherScore);
  }

  return merged;
}

export function buildRois(
  peaks: Peak[],
  processed: ProcessedSpectrum,
  detectorIds: string[],
  settings: RoiDetectionSettings,
) {
  const sortedPeaks = [...peaks].sort(
    (left, right) => left.refinedChannel - right.refinedChannel,
  );
  const rois = sortedPeaks.map((peak, index) => ({
    ...growByLocalScore(peak, sortedPeaks, processed, settings, index),
    detectorIds,
  }));

  return mergeAdjacentRois(splitOverlappingRois(rois), processed, null);
}

export function computeInformationPerChannel(
  sourceChannels: number[],
  backgroundChannels: number[],
  metric: InformationMetric = "fisher",
) {
  return sourceChannels.map((sourceValue, index) => {
    const backgroundValue = backgroundChannels[index] ?? 0;
    const signal = Math.max(0, sourceValue);
    const background = Math.max(EPSILON, backgroundValue);
    const combined = signal + background;

    if (metric === "current") {
      // Previous implementation, intentionally kept for reference:
      // return alpha * Math.log(1 + alpha / phi);
      const alpha = Math.max(0, sourceValue - backgroundValue);
      const phi = Math.max(EPSILON, backgroundValue);
      return alpha * Math.log(1 + alpha / phi);
    }

    if (metric === "kl" || metric === "proposed") {
      // Poisson KL divergence: (s_i + b_i) * ln((s_i + b_i) / b_i) - s_i.
      return combined * Math.log(combined / background) - signal;
    }

    // Fisher information for mass m=1: s_i^2 / (m * s_i + b_i).
    return (signal * signal) / combined;
  });
}

export function computeTotalInformation(
  sourceChannels: number[],
  backgroundChannels: number[],
  settings: RoiDetectionSettings,
  metric: InformationMetric,
) {
  const infoPerChannel = computeInformationPerChannel(
    sourceChannels,
    backgroundChannels,
    metric,
  );
  const minChannel = Math.max(0, settings.minChannel);
  const maxChannel = Math.min(infoPerChannel.length - 1, settings.maxChannel);

  return infoPerChannel.reduce(
    (sum, value, channel) =>
      channel >= minChannel && channel <= maxChannel ? sum + value : sum,
    0,
  );
}

export function buildInformationRois(
  peaks: Peak[],
  processed: ProcessedSpectrum,
  detectorIds: string[],
  sourceChannels: number[],
  backgroundChannels: number[],
  settings: RoiDetectionSettings,
  metric: InformationMetric = "fisher",
) {
  const infoPerChannel = computeInformationPerChannel(
    sourceChannels,
    backgroundChannels,
    metric,
  );
  return buildRoisFromInformation(
    peaks,
    processed,
    detectorIds,
    infoPerChannel,
    settings,
  );
}

export function buildRoisFromInformation(
  peaks: Peak[],
  processed: ProcessedSpectrum,
  detectorIds: string[],
  infoPerChannel: number[],
  settings: RoiDetectionSettings,
) {
  const minChannel = Math.max(0, settings.minChannel);
  const maxChannel = Math.min(infoPerChannel.length - 1, settings.maxChannel);
  const workingInfoPerChannel = infoPerChannel.map((value, channel) =>
    channel >= minChannel && channel <= maxChannel ? value : 0,
  );
  const totalInformation = workingInfoPerChannel.reduce(
    (sum, value) => sum + value,
    0,
  );
  const sortedPeaks = [...peaks]
    .sort((left, right) => left.refinedChannel - right.refinedChannel)
    .filter(
      (peak) =>
        peak.refinedChannel >= minChannel && peak.refinedChannel <= maxChannel,
    );
  const rois = sortedPeaks.map((peak, index) => ({
    ...growByInformation(
      peak,
      sortedPeaks,
      processed,
      workingInfoPerChannel,
      totalInformation,
      settings,
      index,
    ),
    detectorIds,
  }));

  const normalizedRois = splitOverlappingRois(rois);

  return {
    rois: mergeAdjacentRois(normalizedRois, processed, workingInfoPerChannel),
    infoPerChannel: workingInfoPerChannel,
    totalInformation,
  };
}
