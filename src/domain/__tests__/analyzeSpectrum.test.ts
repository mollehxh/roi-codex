import { describe, expect, it } from "vitest";
import { analyzeSpectrum } from "../analysis/analyzeSpectrum";
import {
  DEFAULT_PEAK_DETECTION_SETTINGS,
  DEFAULT_PREPROCESSING_SETTINGS,
  DEFAULT_ROI_DETECTION_SETTINGS,
  type DetectorSpectrum,
} from "../../types/spectrum";

function buildSyntheticDetector(
  detectorId: string,
  peakChannels: [number, number] = [220, 612],
): DetectorSpectrum {
  const [firstPeakChannel, secondPeakChannel] = peakChannels;
  const channels = Array.from({ length: 1024 }, (_, index) => {
    const noise = 4 + Math.sin(index / 40) * 0.6;
    const firstPeak =
      130 * Math.exp(-((index - firstPeakChannel) ** 2) / (2 * 11 ** 2));
    const secondPeak =
      115 * Math.exp(-((index - secondPeakChannel) ** 2) / (2 * 15 ** 2));
    return noise + firstPeak + secondPeak;
  });

  return {
    detectorId,
    name: detectorId,
    header: {
      time: 1,
      height: 0,
      coeffB: 0,
      flag: 0,
    },
    channels,
    rejectChannels: new Array(1024).fill(0),
    calibration: {
      slope: 13 / 1023,
      intercept: 0,
    },
  };
}

describe("analyzeSpectrum", () => {
  it("detects peaks and ROIs on a synthetic spectrum", () => {
    const detector = buildSyntheticDetector("detector-1");
    const analysis = analyzeSpectrum({
      detectors: [detector],
      selectedDetectorIds: [detector.detectorId],
      analysisMode: "single",
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(analysis.peaks.length).toBeGreaterThanOrEqual(2);
    expect(analysis.rois.length).toBeGreaterThanOrEqual(2);
    expect(analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 220) < 8)).toBe(
      true,
    );
    expect(analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 612) < 10)).toBe(
      true,
    );
    expect(analysis.rois.every((roi) => roi.endChannel > roi.startChannel)).toBe(true);
  });

  it("averages selected detectors before analysis", () => {
    const detectorA = buildSyntheticDetector("detector-1");
    const detectorB = buildSyntheticDetector("detector-2");
    detectorB.channels = detectorB.channels.map((value) => value * 0.5);

    const analysis = analyzeSpectrum({
      detectors: [detectorA, detectorB],
      selectedDetectorIds: [detectorA.detectorId, detectorB.detectorId],
      analysisMode: "single",
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(analysis.aggregated.detectorIds).toHaveLength(2);
    expect(analysis.aggregated.channels[220]).toBeCloseTo(
      (detectorA.channels[220] + detectorB.channels[220]) / 2,
      5,
    );
  });

  it("does not produce broad ROIs on a nearly flat spectrum", () => {
    const flatDetector = buildSyntheticDetector("flat");
    flatDetector.channels = flatDetector.channels.map((_, index) => 3 + Math.sin(index / 20) * 0.2);

    const analysis = analyzeSpectrum({
      detectors: [flatDetector],
      selectedDetectorIds: [flatDetector.detectorId],
      analysisMode: "single",
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: {
        ...DEFAULT_PEAK_DETECTION_SETTINGS,
        minHeightRatio: 0.08,
        minProminence: 0.01,
      },
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(analysis.rois.length).toBeLessThanOrEqual(2);
    expect(analysis.rois.every((roi) => roi.width < 24)).toBe(true);
  });

  it("deduplicates refined peaks that collapse to the same center", () => {
    const detector = buildSyntheticDetector("detector-1");
    detector.channels = detector.channels.map((value, index) => {
      const closePeak = 95 * Math.exp(-((index - 36) ** 2) / (2 * 5 ** 2));
      const shoulder = 40 * Math.exp(-((index - 42) ** 2) / (2 * 6 ** 2));
      return value + closePeak + shoulder;
    });

    const analysis = analyzeSpectrum({
      detectors: [detector],
      selectedDetectorIds: [detector.detectorId],
      analysisMode: "single",
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: {
        ...DEFAULT_PEAK_DETECTION_SETTINGS,
        minDistance: 6,
      },
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    const centers = analysis.rois.map((roi) => roi.peakChannel.toFixed(1));
    expect(new Set(centers).size).toBe(centers.length);
  });
});
