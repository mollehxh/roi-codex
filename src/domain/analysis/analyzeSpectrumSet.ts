import {
  buildRoisFromInformation,
  computeInformationPerChannel,
} from "../roi/roiDetection";
import {
  aggregateDetectors,
  averageAggregatedSpectra,
} from "../spectrum/aggregation";
import {
  buildPeaksFromChannels,
  detectPeaks,
} from "../spectrum/peakDetection";
import { preprocessSpectrum } from "../spectrum/preprocessing";
import { analyzeSpectrum } from "./analyzeSpectrum";
import type {
  AggregatedSpectrum,
  AggregationMode,
  DetectorSpectrum,
  InformationMetric,
  PeakSearchSignal,
  LoadedSpcFile,
  Peak,
  PeakDetectionSettings,
  PreprocessingSettings,
  ProcessedSpectrum,
  ROI,
  RoiDetectionSettings,
  SpectrumAnalysisResult,
} from "../../types/spectrum";

interface AnalyzeSpectrumSetInput {
  sourceFiles: LoadedSpcFile[];
  backgroundFiles?: LoadedSpcFile[];
  selectedDetectorIds: string[];
  manualPeakChannels?: number[];
  aggregationMode: AggregationMode;
  preprocessingSettings: PreprocessingSettings;
  peakDetectionSettings: PeakDetectionSettings;
  roiDetectionSettings: RoiDetectionSettings;
  informationMetric?: InformationMetric;
  peakSearchSignal?: PeakSearchSignal;
}

interface SourceCandidateAnalysis {
  sourceIndex: number;
  source: AggregatedSpectrum;
  background: AggregatedSpectrum;
  infoPerChannel: number[];
  processedInfo: ProcessedSpectrum;
  peaks: Peak[];
  rois: ROI[];
  totalInformation: number;
}

interface MergedCandidateInterval {
  startChannel: number;
  endChannel: number;
  sourceIndexes: Set<number>;
}

interface EvaluatedCommonRoi {
  startChannel: number;
  endChannel: number;
  peakChannel: number;
  information: number;
  informationFraction: number;
  backgroundInformation: number;
  discriminationScore: number;
  supportCount: number;
}

const EPSILON = 1e-12;

function aggregateFile(
  file: LoadedSpcFile,
  selectedDetectorIds: string[],
  aggregationMode: AggregationMode,
) {
  return aggregateDetectors(file.detectors, selectedDetectorIds, aggregationMode);
}

function buildMeanSpectrum(
  spectra: AggregatedSpectrum[],
  aggregationMode: AggregationMode,
) {
  return spectra.length > 0
    ? averageAggregatedSpectra(spectra, aggregationMode)
    : null;
}

function buildDetectorFromAggregated(
  aggregated: AggregatedSpectrum,
  detectorId: string,
): DetectorSpectrum {
  return {
    detectorId,
    name: detectorId,
    header: {
      time: 0,
      height: 0,
      coeffB: 0,
      flag: 0,
    },
    channels: aggregated.channels,
    rejectChannels: new Array(aggregated.channels.length).fill(0),
    calibration: aggregated.calibration,
  };
}

function buildZeroBackground(source: AggregatedSpectrum): AggregatedSpectrum {
  return {
    detectorIds: source.detectorIds,
    mode: source.mode,
    channels: new Array(source.channels.length).fill(0),
    calibration: source.calibration,
  };
}

function assertSameChannelCount(left: AggregatedSpectrum, right: AggregatedSpectrum) {
  if (left.channels.length !== right.channels.length) {
    throw new Error("Спектр источника и фон должны иметь одинаковое число каналов.");
  }
}

function resolveBackgroundForSource(
  source: AggregatedSpectrum,
  sourceIndex: number,
  sourceCount: number,
  backgrounds: AggregatedSpectrum[],
  averageBackground: AggregatedSpectrum | null,
) {
  if (backgrounds.length === 0) {
    return buildZeroBackground(source);
  }

  const background =
    backgrounds.length === sourceCount
      ? backgrounds[sourceIndex]
      : averageBackground;

  if (!background) {
    return buildZeroBackground(source);
  }

  assertSameChannelCount(source, background);
  return background;
}

function sumRange(values: number[], startChannel: number, endChannel: number) {
  let sum = 0;

  for (let channel = startChannel; channel <= endChannel; channel += 1) {
    sum += Math.max(0, values[channel] ?? 0);
  }

  return sum;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanPairwiseAbsoluteDifference(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  let sum = 0;
  let count = 0;

  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      sum += Math.abs(values[left] - values[right]);
      count += 1;
    }
  }

  return count > 0 ? sum / count : 0;
}

function buildUtilityProfile(candidateAnalyses: SourceCandidateAnalysis[]) {
  const firstAnalysis = candidateAnalyses[0];

  if (!firstAnalysis) {
    return [];
  }

  const channelCount = firstAnalysis.infoPerChannel.length;

  return Array.from({ length: channelCount }, (_, channel) => {
    const values = candidateAnalyses.map(
      (analysis) => analysis.infoPerChannel[channel] ?? 0,
    );
    const backgroundInformation = average(values);
    const discrimination =
      meanPairwiseAbsoluteDifference(values) /
      Math.max(backgroundInformation, EPSILON);

    return backgroundInformation * discrimination;
  });
}

function buildInfoSpectrum(
  source: AggregatedSpectrum,
  infoPerChannel: number[],
  aggregationMode: AggregationMode,
): AggregatedSpectrum {
  return {
    detectorIds: source.detectorIds,
    mode: aggregationMode,
    channels: infoPerChannel,
    calibration: source.calibration,
  };
}

function buildCombinedSpectrum(
  source: AggregatedSpectrum,
  background: AggregatedSpectrum,
  aggregationMode: AggregationMode,
): AggregatedSpectrum {
  return {
    detectorIds: source.detectorIds,
    mode: aggregationMode,
    channels: source.channels.map(
      (value, index) => value + (background.channels[index] ?? 0),
    ),
    calibration: source.calibration,
  };
}

function analyzeSourceAgainstBackground(
  source: AggregatedSpectrum,
  background: AggregatedSpectrum,
  sourceIndex: number,
  manualPeakChannels: number[] | undefined,
  aggregationMode: AggregationMode,
  preprocessingSettings: PreprocessingSettings,
  peakDetectionSettings: PeakDetectionSettings,
  roiDetectionSettings: RoiDetectionSettings,
  informationMetric: InformationMetric,
  peakSearchSignal: PeakSearchSignal,
): SourceCandidateAnalysis {
  const infoPerChannel = computeInformationPerChannel(
    source.channels,
    background.channels,
    informationMetric,
  );
  const peakSearchSpectrum =
    peakSearchSignal === "combined"
      ? buildCombinedSpectrum(source, background, aggregationMode)
      : source;
  const processedSource = preprocessSpectrum(
    peakSearchSpectrum,
    preprocessingSettings,
  );
  const infoSpectrum = buildInfoSpectrum(source, infoPerChannel, aggregationMode);
  const processedInfo = preprocessSpectrum(infoSpectrum, preprocessingSettings);
  const autoPeaks = detectPeaks(
    processedSource,
    peakDetectionSettings,
    peakSearchSpectrum.calibration,
  ).peaks;
  const peaks =
    manualPeakChannels && manualPeakChannels.length > 0
      ? buildPeaksFromChannels(
          processedSource,
          manualPeakChannels,
          peakDetectionSettings,
          peakSearchSpectrum.calibration,
          "manual",
        )
      : autoPeaks;
  const informationRois = buildRoisFromInformation(
    peaks,
    processedSource,
    source.detectorIds,
    infoPerChannel,
    roiDetectionSettings,
  );

  return {
    sourceIndex,
    source,
    background,
    infoPerChannel: informationRois.infoPerChannel,
    processedInfo,
    peaks,
    rois: informationRois.rois,
    totalInformation: informationRois.totalInformation,
  };
}

function mergeCandidateIntervals(
  candidateAnalyses: SourceCandidateAnalysis[],
) {
  const candidates = candidateAnalyses
    .flatMap((analysis) =>
      analysis.rois.map((roi) => ({
        startChannel: roi.startChannel,
        endChannel: roi.endChannel,
        sourceIndex: analysis.sourceIndex,
      })),
    )
    .sort((left, right) => left.startChannel - right.startChannel);
  const merged: MergedCandidateInterval[] = [];

  for (const candidate of candidates) {
    const previous = merged[merged.length - 1];

    if (!previous || candidate.startChannel > previous.endChannel + 1) {
      merged.push({
        startChannel: candidate.startChannel,
        endChannel: candidate.endChannel,
        sourceIndexes: new Set([candidate.sourceIndex]),
      });
      continue;
    }

    previous.endChannel = Math.max(previous.endChannel, candidate.endChannel);
    previous.sourceIndexes.add(candidate.sourceIndex);
  }

  return merged;
}

function findPeakChannel(
  utilityProfile: number[],
  startChannel: number,
  endChannel: number,
) {
  let peakChannel = startChannel;
  let maxValue = utilityProfile[startChannel] ?? 0;

  for (let channel = startChannel + 1; channel <= endChannel; channel += 1) {
    const value = utilityProfile[channel] ?? 0;

    if (value > maxValue) {
      maxValue = value;
      peakChannel = channel;
    }
  }

  return peakChannel;
}

function countSupportedSpectra(infoSums: number[]) {
  const maxInformation = Math.max(...infoSums, 0);
  const meanInformation = average(infoSums);
  const supportThreshold = Math.max(
    maxInformation * 0.12,
    meanInformation * 0.25,
    EPSILON,
  );

  return infoSums.filter((value) => value >= supportThreshold).length;
}

function evaluateCommonRois(
  intervals: MergedCandidateInterval[],
  candidateAnalyses: SourceCandidateAnalysis[],
  utilityProfile: number[],
  settings: RoiDetectionSettings,
) {
  const sourceCount = candidateAnalyses.length;
  const minimumSupport = sourceCount <= 2 ? 1 : 2;
  const averageTotalInformation = average(
    candidateAnalyses.map((analysis) => analysis.totalInformation),
  );
  const backgroundFractionThreshold = Math.max(
    0.001,
    settings.relativeInfoGrowthThreshold * 0.2,
  );
  const discriminationThreshold =
    sourceCount < 2
      ? 0
      : Math.max(0.12, settings.growthStabilityThreshold * 8);
  const totalUtility = utilityProfile.reduce((sum, value) => sum + value, 0);

  return intervals
    .map((interval) => {
      const infoSums = candidateAnalyses.map((analysis) =>
        sumRange(
          analysis.infoPerChannel,
          interval.startChannel,
          interval.endChannel,
        ),
      );
      const backgroundInformation = average(infoSums);
      const backgroundFraction =
        averageTotalInformation > EPSILON
          ? backgroundInformation / averageTotalInformation
          : 0;
      const discriminationScore =
        meanPairwiseAbsoluteDifference(infoSums) /
        Math.max(backgroundInformation, EPSILON);
      const information = sumRange(
        utilityProfile,
        interval.startChannel,
        interval.endChannel,
      );
      const supportCount = Math.max(
        interval.sourceIndexes.size,
        countSupportedSpectra(infoSums),
      );

      return {
        startChannel: interval.startChannel,
        endChannel: interval.endChannel,
        peakChannel: findPeakChannel(
          utilityProfile,
          interval.startChannel,
          interval.endChannel,
        ),
        information,
        informationFraction: totalUtility > EPSILON ? information / totalUtility : 0,
        backgroundInformation,
        backgroundFraction,
        discriminationScore,
        supportCount,
      };
    })
    .filter((roi) => roi.supportCount >= minimumSupport)
    .filter((roi) => roi.backgroundFraction >= backgroundFractionThreshold)
    .filter((roi) => roi.discriminationScore >= discriminationThreshold)
    .sort((left, right) => left.startChannel - right.startChannel);
}

function buildCommonPeaks(
  rois: EvaluatedCommonRoi[],
  calibration: AggregatedSpectrum["calibration"],
): Peak[] {
  return rois.map((roi, index) => ({
    id: `peak-${index + 1}`,
    channel: roi.peakChannel,
    refinedChannel: roi.peakChannel,
    value: roi.information,
    prominence: roi.discriminationScore,
    widthHint: roi.endChannel - roi.startChannel + 1,
    energy: calibration.slope * roi.peakChannel + calibration.intercept,
    source: "auto",
  }));
}

function buildCommonRois(
  rois: EvaluatedCommonRoi[],
  detectorIds: string[],
): ROI[] {
  return rois.map((roi, index) => ({
    id: `roi-${index + 1}`,
    startChannel: roi.startChannel,
    endChannel: roi.endChannel,
    peakChannel: roi.peakChannel,
    width: roi.endChannel - roi.startChannel + 1,
    score:
      roi.backgroundInformation *
      roi.discriminationScore *
      Math.max(1, roi.supportCount),
    klScore: roi.backgroundInformation,
    fisherScore: roi.discriminationScore,
    information: roi.information,
    informationFraction: roi.informationFraction,
    detectorIds,
    peakId: `peak-${index + 1}`,
  }));
}

function buildAverageBackgroundForDisplay(
  backgrounds: AggregatedSpectrum[],
  aggregationMode: AggregationMode,
  fallback: AggregatedSpectrum,
) {
  return backgrounds.length > 0
    ? averageAggregatedSpectra(backgrounds, aggregationMode)
    : buildZeroBackground(fallback);
}

export function analyzeSpectrumSet({
  sourceFiles,
  backgroundFiles = [],
  selectedDetectorIds,
  manualPeakChannels,
  aggregationMode,
  preprocessingSettings,
  peakDetectionSettings,
  roiDetectionSettings,
  informationMetric = "fisher",
  peakSearchSignal = "element",
}: AnalyzeSpectrumSetInput): SpectrumAnalysisResult {
  if (sourceFiles.length === 0) {
    throw new Error("Загрузите хотя бы один спектр источника.");
  }

  const sourceAggregates = sourceFiles.map((file) =>
    aggregateFile(file, selectedDetectorIds, aggregationMode),
  );
  const backgroundAggregates = backgroundFiles.map((file) =>
    aggregateFile(file, selectedDetectorIds, aggregationMode),
  );
  const backgroundMean = buildMeanSpectrum(backgroundAggregates, aggregationMode);

  if (sourceAggregates.length === 1) {
    const backgroundDetector = backgroundMean
      ? buildDetectorFromAggregated(backgroundMean, "background-mean")
      : null;

    return analyzeSpectrum({
      detectors: sourceFiles[0].detectors,
      selectedDetectorIds,
      analysisMode: backgroundDetector ? "comparison" : "single",
      backgroundDetectors: backgroundDetector ? [backgroundDetector] : undefined,
      selectedBackgroundDetectorIds: backgroundDetector
        ? [backgroundDetector.detectorId]
        : undefined,
      manualPeakChannels,
      aggregationMode,
      preprocessingSettings,
      peakDetectionSettings,
      roiDetectionSettings,
      informationMetric,
      peakSearchSignal,
    });
  }

  const sourceMean = averageAggregatedSpectra(sourceAggregates, aggregationMode);
  const candidateAnalyses = sourceAggregates.map((source, sourceIndex) =>
    analyzeSourceAgainstBackground(
      source,
      resolveBackgroundForSource(
        source,
        sourceIndex,
        sourceAggregates.length,
        backgroundAggregates,
        backgroundMean,
      ),
      sourceIndex,
      manualPeakChannels,
      aggregationMode,
      preprocessingSettings,
      peakDetectionSettings,
      roiDetectionSettings,
      informationMetric,
      peakSearchSignal,
    ),
  );
  const utilityProfile = buildUtilityProfile(candidateAnalyses);
  const discriminant: AggregatedSpectrum = {
    detectorIds: [...selectedDetectorIds],
    mode: aggregationMode,
    channels: utilityProfile,
    calibration: sourceMean.calibration,
  };
  const processed = preprocessSpectrum(discriminant, preprocessingSettings);
  const commonRoiMetrics = evaluateCommonRois(
    mergeCandidateIntervals(candidateAnalyses),
    candidateAnalyses,
    utilityProfile,
    roiDetectionSettings,
  );
  const peaks = buildCommonPeaks(commonRoiMetrics, sourceMean.calibration);
  const rois = buildCommonRois(commonRoiMetrics, selectedDetectorIds);
  const displayBackground = buildAverageBackgroundForDisplay(
    backgroundAggregates,
    aggregationMode,
    sourceMean,
  );
  const totalInformation = utilityProfile.reduce((sum, value) => sum + value, 0);

  return {
    aggregated: discriminant,
    processed,
    suggestedPeaks: peaks,
    peaks,
    rois,
    comparison: {
      source: sourceMean,
      background: displayBackground,
      difference: discriminant,
      infoPerChannel: utilityProfile,
      totalInformation,
    },
    multiComparison: {
      sources: sourceAggregates.map((spectrum, index) => ({
        id: `source-${index + 1}`,
        name: sourceFiles[index].fileName,
        spectrum,
      })),
      background: displayBackground,
      discriminant,
      infoPerChannel: utilityProfile,
      totalInformation,
    },
  };
}
