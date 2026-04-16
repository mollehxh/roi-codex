import type {
  EnergyCalibration,
  SpectrumHeader,
} from "../../информация для разработки/spc-parser";

export type AggregationMode = "mean";
export type NormalizationMode = "none" | "sum";

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
  minHeightRatio: number;
  minProminence: number;
  minDistance: number;
  refinementRadius: number;
  detectorResolutionPercent: number;
}

export interface RoiDetectionSettings {
  maxExpansion: number;
  minRoiWidth: number;
  degradationTolerance: number;
  maxWeakSteps: number;
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
  detectorIds: string[];
  peakId: string;
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
  peaks: Peak[];
  rois: ROI[];
}

export const DEFAULT_PREPROCESSING_SETTINGS: PreprocessingSettings = {
  smoothingWindow: 5,
  baselineWindow: 51,
  normalizationMode: "sum",
  useBaselineCorrection: true,
};

export const DEFAULT_PEAK_DETECTION_SETTINGS: PeakDetectionSettings = {
  minHeightRatio: 0.035,
  minProminence: 0.004,
  minDistance: 12,
  refinementRadius: 18,
  detectorResolutionPercent: 8,
};

export const DEFAULT_ROI_DETECTION_SETTINGS: RoiDetectionSettings = {
  maxExpansion: 96,
  minRoiWidth: 5,
  degradationTolerance: 0.1,
  maxWeakSteps: 1,
  scoreWeights: {
    kl: 0.6,
    fisher: 0.4,
  },
};

export const DEFAULT_OVERLAY_VISIBILITY: OverlayVisibility = {
  showPeaks: true,
  showRoi: true,
};
