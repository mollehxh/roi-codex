import { buildRois } from "../roi/roiDetection";
import { aggregateDetectors } from "../spectrum/aggregation";
import { detectPeaks } from "../spectrum/peakDetection";
import { preprocessSpectrum } from "../spectrum/preprocessing";
import type {
  AggregationMode,
  DetectorSpectrum,
  PeakDetectionSettings,
  PreprocessingSettings,
  RoiDetectionSettings,
  SpectrumAnalysisResult,
} from "../../types/spectrum";

interface AnalyzeSpectrumInput {
  detectors: DetectorSpectrum[];
  selectedDetectorIds: string[];
  aggregationMode: AggregationMode;
  preprocessingSettings: PreprocessingSettings;
  peakDetectionSettings: PeakDetectionSettings;
  roiDetectionSettings: RoiDetectionSettings;
}

export function analyzeSpectrum({
  detectors,
  selectedDetectorIds,
  aggregationMode,
  preprocessingSettings,
  peakDetectionSettings,
  roiDetectionSettings,
}: AnalyzeSpectrumInput): SpectrumAnalysisResult {
  const aggregated = aggregateDetectors(
    detectors,
    selectedDetectorIds,
    aggregationMode,
  );
  const processed = preprocessSpectrum(aggregated, preprocessingSettings);
  const peaks = detectPeaks(processed, peakDetectionSettings, aggregated.calibration);
  const rois = buildRois(
    peaks,
    processed,
    aggregated.detectorIds,
    roiDetectionSettings,
  );

  return {
    aggregated,
    processed,
    peaks,
    rois,
  };
}
