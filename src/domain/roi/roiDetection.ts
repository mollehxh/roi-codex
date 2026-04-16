import type {
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

interface SideState {
  bestScore: number;
  bestKl: number;
  bestFisher: number;
  weakSteps: number;
  stopped: boolean;
}

const EPSILON = 1e-9;

function normalizeSegment(segment: number[]) {
  const safeSegment = segment.map((value) => Math.max(value, 0) + EPSILON);
  const sum = safeSegment.reduce((accumulator, value) => accumulator + value, 0);

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
  const correctedSlice = processed.corrected.slice(startChannel, endChannel + 1);
  const baselineSlice = processed.baseline.slice(startChannel, endChannel + 1);
  const klScore = computeKlDivergence(correctedSlice, baselineSlice);
  const fisherScore = computeFisherInformation(correctedSlice);
  const score =
    settings.scoreWeights.kl * klScore + settings.scoreWeights.fisher * fisherScore;

  return {
    klScore,
    fisherScore,
    score,
  };
}

function buildInitialSideState(metrics: RoiMetrics): SideState {
  return {
    bestScore: metrics.score,
    bestKl: metrics.klScore,
    bestFisher: metrics.fisherScore,
    weakSteps: 0,
    stopped: false,
  };
}

function shouldAcceptCandidate(
  candidate: RoiMetrics,
  current: RoiMetrics,
  state: SideState,
  settings: RoiDetectionSettings,
) {
  const positiveGain = candidate.score > current.score + EPSILON;
  const strongDegradation =
    candidate.klScore < state.bestKl * (1 - settings.degradationTolerance) &&
    candidate.fisherScore < state.bestFisher * (1 - settings.degradationTolerance);

  if (strongDegradation) {
    return false;
  }

  if (positiveGain) {
    return true;
  }

  return state.weakSteps < settings.maxWeakSteps;
}

function updateSideState(state: SideState, candidate: RoiMetrics, current: RoiMetrics) {
  const positiveGain = candidate.score > current.score + EPSILON;

  state.bestScore = Math.max(state.bestScore, candidate.score);
  state.bestKl = Math.max(state.bestKl, candidate.klScore);
  state.bestFisher = Math.max(state.bestFisher, candidate.fisherScore);
  state.weakSteps = positiveGain ? 0 : state.weakSteps + 1;
}

function padRoiWidth(
  startChannel: number,
  endChannel: number,
  peakChannel: number,
  signalLength: number,
  minimumWidth: number,
) {
  let start = startChannel;
  let end = endChannel;

  while (end - start + 1 < minimumWidth) {
    const canGrowLeft = start > 0;
    const canGrowRight = end < signalLength - 1;

    if (!canGrowLeft && !canGrowRight) {
      break;
    }

    if (canGrowLeft && (!canGrowRight || peakChannel - start <= end - peakChannel)) {
      start -= 1;
      continue;
    }

    if (canGrowRight) {
      end += 1;
    }
  }

  return { start, end };
}

function expandPeakToRoi(
  peak: Peak,
  processed: ProcessedSpectrum,
  detectorIds: string[],
  settings: RoiDetectionSettings,
  index: number,
): ROI {
  const signalLength = processed.corrected.length;
  let startChannel = Math.round(peak.refinedChannel);
  let endChannel = Math.round(peak.refinedChannel);
  const maxHalfWidth = Math.max(
    settings.minRoiWidth,
    Math.min(settings.maxExpansion, Math.round(Math.max(peak.widthHint, 4) * 1.6)),
  );
  let currentMetrics = evaluateRoi(processed, startChannel, endChannel, settings);
  const leftState = buildInitialSideState(currentMetrics);
  const rightState = buildInitialSideState(currentMetrics);
  let iterations = 0;

  while (
    iterations < settings.maxExpansion &&
    (!leftState.stopped || !rightState.stopped)
  ) {
    const proposals: Array<{
      side: "left" | "right";
      nextStart: number;
      nextEnd: number;
      metrics: RoiMetrics;
      delta: number;
    }> = [];

    if (
      !leftState.stopped &&
      startChannel > 0 &&
      Math.round(peak.refinedChannel) - startChannel < maxHalfWidth
    ) {
      const nextStart = startChannel - 1;
      const metrics = evaluateRoi(processed, nextStart, endChannel, settings);
      const edgeSignal = processed.corrected[nextStart];
      const edgeBaseline = processed.baseline[nextStart] + EPSILON;
      proposals.push({
        side: "left",
        nextStart,
        nextEnd: endChannel,
        metrics,
        delta:
          metrics.score -
          currentMetrics.score +
          Math.log1p(edgeSignal / edgeBaseline) * 0.02,
      });
    } else {
      leftState.stopped = true;
    }

    if (
      !rightState.stopped &&
      endChannel < signalLength - 1 &&
      endChannel - Math.round(peak.refinedChannel) < maxHalfWidth
    ) {
      const nextEnd = endChannel + 1;
      const metrics = evaluateRoi(processed, startChannel, nextEnd, settings);
      const edgeSignal = processed.corrected[nextEnd];
      const edgeBaseline = processed.baseline[nextEnd] + EPSILON;
      proposals.push({
        side: "right",
        nextStart: startChannel,
        nextEnd,
        metrics,
        delta:
          metrics.score -
          currentMetrics.score +
          Math.log1p(edgeSignal / edgeBaseline) * 0.02,
      });
    } else {
      rightState.stopped = true;
    }

    if (proposals.length === 0) {
      break;
    }

    proposals.sort((left, right) => right.delta - left.delta);
    const proposal = proposals[0];
    const sideState = proposal.side === "left" ? leftState : rightState;

    if (!shouldAcceptCandidate(proposal.metrics, currentMetrics, sideState, settings)) {
      sideState.stopped = true;
      iterations += 1;
      continue;
    }

    startChannel = proposal.nextStart;
    endChannel = proposal.nextEnd;
    updateSideState(sideState, proposal.metrics, currentMetrics);
    currentMetrics = proposal.metrics;
    iterations += 1;
  }

  const padded = padRoiWidth(
    startChannel,
    endChannel,
    Math.round(peak.refinedChannel),
    signalLength,
    settings.minRoiWidth,
  );
  currentMetrics = evaluateRoi(processed, padded.start, padded.end, settings);

  return {
    id: `roi-${index + 1}`,
    startChannel: padded.start,
    endChannel: padded.end,
    peakChannel: peak.refinedChannel,
    width: padded.end - padded.start + 1,
    score: currentMetrics.score,
    klScore: currentMetrics.klScore,
    fisherScore: currentMetrics.fisherScore,
    detectorIds,
    peakId: peak.id,
  };
}

function splitOverlappingRois(rois: ROI[]) {
  const result = rois.map((roi) => ({ ...roi })).sort((left, right) => left.peakChannel - right.peakChannel);

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

export function buildRois(
  peaks: Peak[],
  processed: ProcessedSpectrum,
  detectorIds: string[],
  settings: RoiDetectionSettings,
) {
  const rois = peaks.map((peak, index) =>
    expandPeakToRoi(peak, processed, detectorIds, settings, index),
  );

  return splitOverlappingRois(rois);
}
