import type {
  EnergyCalibration,
  SpectrumHeader,
} from "../../информация для разработки/spc-parser";

export type { EnergyCalibration, SpectrumHeader };

export type AggregationMode = "mean";
export type NormalizationMode = "none" | "sum";
export type AnalysisMode = "single" | "comparison";
export type PeakSelectionMode = "auto" | "manual";
export type InformationMetric = "current" | "proposed" | "kl" | "fisher";
export type PeakSearchSignal = "element" | "combined";

export interface DetectorSpectrum {
  detectorId: string;
  name: string;
  header: SpectrumHeader;
  channels: number[];
  rejectChannels: number[];
  calibration: EnergyCalibration;
}

export interface LoadedSpcFile {
  fileName: string;
  fileSize: number;
  detectorCount: number;
  detectors: DetectorSpectrum[];
}

export interface AggregatedSpectrum {
  detectorIds: string[];
  mode: AggregationMode;
  channels: number[];
  calibration: EnergyCalibration;
}

export interface PreprocessingSettings {
  smoothingWindow: number;
  baselineWindow: number;
  normalizationMode: NormalizationMode;
  useBaselineCorrection: boolean;
}

export interface PeakDetectionSettings {
  minChannel: number;
  maxChannel: number;
  minHeightRatio: number;
  minProminence: number;
  minDistance: number;
  refinementRadius: number;
  detectorResolutionPercent: number;
  fullScaleMeV: number;
}

export interface RoiDetectionSettings {
  minChannel: number;
  maxChannel: number;
  maxExpansion: number;
  minRoiWidth: number;
  degradationTolerance: number;
  maxWeakSteps: number;
  growthStabilityWindow: number;
  growthStabilityThreshold: number;
  relativeInfoGrowthThreshold: number;
  maxGrowthSteps: number;
  scoreWeights: {
    kl: number;
    fisher: number;
  };
}

export interface OverlayVisibility {
  showPeaks: boolean;
  showRoi: boolean;
}

export interface Peak {
  id: string;
  channel: number;
  refinedChannel: number;
  value: number;
  prominence: number;
  widthHint: number;
  energy: number;
  source: PeakSelectionMode;
}

export interface ROI {
  id: string;
  startChannel: number;
  endChannel: number;
  peakChannel: number;
  width: number;
  score: number;
  klScore: number;
  fisherScore: number;
  information: number;
  informationFraction: number;
  detectorIds: string[];
  peakId: string;
}

export interface ComparisonSpectrum {
  source: AggregatedSpectrum;
  background: AggregatedSpectrum;
  difference: AggregatedSpectrum;
  infoPerChannel: number[];
  totalInformation: number;
}

export interface NamedAggregatedSpectrum {
  id: string;
  name: string;
  spectrum: AggregatedSpectrum;
}

export interface MultiSpectrumComparison {
  sources: NamedAggregatedSpectrum[];
  background: AggregatedSpectrum | null;
  discriminant: AggregatedSpectrum;
  infoPerChannel: number[];
  totalInformation: number;
}

export interface ProcessedSpectrum {
  raw: number[];
  smoothed: number[];
  baseline: number[];
  corrected: number[];
  normalized: number[];
}

export interface SpectrumAnalysisResult {
  aggregated: AggregatedSpectrum;
  processed: ProcessedSpectrum;
  suggestedPeaks: Peak[];
  peaks: Peak[];
  rois: ROI[];
  comparison: ComparisonSpectrum | null;
  multiComparison: MultiSpectrumComparison | null;
}

export const DEFAULT_PREPROCESSING_SETTINGS: PreprocessingSettings = {
  smoothingWindow: 5,
  baselineWindow: 51,
  normalizationMode: "sum",
  useBaselineCorrection: true,
};

export const DEFAULT_PEAK_DETECTION_SETTINGS: PeakDetectionSettings = {
  minChannel: 200,
  maxChannel: 900,
  minHeightRatio: 0.035,
  minProminence: 0.004,
  minDistance: 12,
  refinementRadius: 18,
  detectorResolutionPercent: 1,
  fullScaleMeV: 12,
};

export const DEFAULT_ROI_DETECTION_SETTINGS: RoiDetectionSettings = {
  minChannel: 200,
  maxChannel: 900,
  maxExpansion: 96,
  minRoiWidth: 5,
  degradationTolerance: 0.1,
  maxWeakSteps: 1,
  growthStabilityWindow: 5,
  growthStabilityThreshold: 0.01,
  relativeInfoGrowthThreshold: 0.01,
  maxGrowthSteps: 200,
  scoreWeights: {
    kl: 0.6,
    fisher: 0.4,
  },
};

export const DEFAULT_OVERLAY_VISIBILITY: OverlayVisibility = {
  showPeaks: true,
  showRoi: true,
};
