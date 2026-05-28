import {
  buildRoisFromInformation,
  computeInformationPerChannel,
  buildRois,
} from "../roi/roiDetection";
import { aggregateDetectors } from "../spectrum/aggregation";
import {
  buildPeaksFromChannels,
  detectPeaks,
} from "../spectrum/peakDetection";
import { preprocessSpectrum } from "../spectrum/preprocessing";
import type {
  AnalysisMode,
  AggregationMode,
  ComparisonSpectrum,
  DetectorSpectrum,
  InformationMetric,
  PeakSearchSignal,
  PeakDetectionSettings,
  PreprocessingSettings,
  RoiDetectionSettings,
  SpectrumAnalysisResult,
} from "../../types/spectrum";

interface AnalyzeSpectrumInput {
  detectors: DetectorSpectrum[];
  selectedDetectorIds: string[];
  analysisMode: AnalysisMode;
  backgroundDetectors?: DetectorSpectrum[];
  selectedBackgroundDetectorIds?: string[];
  manualPeakChannels?: number[];
  aggregationMode: AggregationMode;
  preprocessingSettings: PreprocessingSettings;
  peakDetectionSettings: PeakDetectionSettings;
  roiDetectionSettings: RoiDetectionSettings;
  informationMetric?: InformationMetric;
  peakSearchSignal?: PeakSearchSignal;
}

export function analyzeSpectrum({
  detectors,
  selectedDetectorIds,
  analysisMode,
  backgroundDetectors,
  selectedBackgroundDetectorIds,
  manualPeakChannels,
  aggregationMode,
  preprocessingSettings,
  peakDetectionSettings,
  roiDetectionSettings,
  informationMetric = "fisher",
  peakSearchSignal = "element",
}: AnalyzeSpectrumInput): SpectrumAnalysisResult {
  const sourceAggregated = aggregateDetectors(
    detectors,
    selectedDetectorIds,
    aggregationMode,
  );
  let comparison: ComparisonSpectrum | null = null;
  let aggregated = sourceAggregated;
  let peakSearchAggregated = sourceAggregated;
  let infoPerChannel: number[] | null = null;

  if (
    analysisMode === "comparison" &&
    backgroundDetectors &&
    selectedBackgroundDetectorIds &&
    selectedBackgroundDetectorIds.length > 0
  ) {
    const backgroundAggregated = aggregateDetectors(
      backgroundDetectors,
      selectedBackgroundDetectorIds,
      aggregationMode,
    );
    infoPerChannel = computeInformationPerChannel(
      sourceAggregated.channels,
      backgroundAggregated.channels,
      informationMetric,
    );
    if (peakSearchSignal === "combined") {
      peakSearchAggregated = {
        detectorIds: sourceAggregated.detectorIds,
        mode: aggregationMode,
        channels: sourceAggregated.channels.map(
          (value, index) => value + (backgroundAggregated.channels[index] ?? 0),
        ),
        calibration: sourceAggregated.calibration,
      };
    }
    comparison = {
      source: sourceAggregated,
      background: backgroundAggregated,
      difference: {
        detectorIds: sourceAggregated.detectorIds,
        mode: aggregationMode,
        channels: sourceAggregated.channels.map(
          (value, index) => value - (backgroundAggregated.channels[index] ?? 0),
        ),
        calibration: sourceAggregated.calibration,
      },
      infoPerChannel,
      totalInformation: 0,
    };
  }

  const processed = preprocessSpectrum(peakSearchAggregated, preprocessingSettings);
  const autoPeaks = detectPeaks(
    processed,
    peakDetectionSettings,
    peakSearchAggregated.calibration,
  );
  const suggestedPeaks = autoPeaks.peaks;
  const peaks =
    manualPeakChannels && manualPeakChannels.length > 0
      ? buildPeaksFromChannels(
          processed,
          manualPeakChannels,
          peakDetectionSettings,
          peakSearchAggregated.calibration,
          "manual",
        )
      : suggestedPeaks;

  let rois = buildRois(peaks, processed, aggregated.detectorIds, roiDetectionSettings);

  if (comparison && infoPerChannel) {
    const comparisonRois = buildRoisFromInformation(
      peaks,
      processed,
      aggregated.detectorIds,
      infoPerChannel,
      roiDetectionSettings,
    );
    rois = comparisonRois.rois;
    comparison.infoPerChannel = comparisonRois.infoPerChannel;
    comparison.totalInformation = comparisonRois.totalInformation;
  }

  return {
    aggregated,
    suggestedPeaks,
    processed,
    peaks,
    rois,
    comparison,
    multiComparison: null,
  };
}
