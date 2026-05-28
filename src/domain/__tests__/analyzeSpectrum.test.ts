import { describe, expect, it } from "vitest";
import { analyzeSpectrum } from "../analysis/analyzeSpectrum";
import { analyzeSpectrumSet } from "../analysis/analyzeSpectrumSet";
import {
  buildRoisFromInformation,
  computeInformationPerChannel,
} from "../roi/roiDetection";
import {
  DEFAULT_PEAK_DETECTION_SETTINGS,
  DEFAULT_PREPROCESSING_SETTINGS,
  DEFAULT_ROI_DETECTION_SETTINGS,
  type DetectorSpectrum,
  type LoadedSpcFile,
  type Peak,
  type ProcessedSpectrum,
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

function buildSinglePeakDetector(
  detectorId: string,
  peakChannel: number,
): DetectorSpectrum {
  const channels = Array.from({ length: 1024 }, (_, index) => {
    const background = 5 + Math.sin(index / 48) * 0.3;
    const peak = 150 * Math.exp(-((index - peakChannel) ** 2) / (2 * 11 ** 2));
    return background + peak;
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

function buildCustomPeakDetector(
  detectorId: string,
  peaks: Array<{ channel: number; amplitude: number; width: number }>,
): DetectorSpectrum {
  const channels = Array.from({ length: 1024 }, (_, index) => {
    const background = 5 + Math.sin(index / 48) * 0.3;
    const peakSignal = peaks.reduce((sum, peak) => {
      return (
        sum +
        peak.amplitude *
          Math.exp(-((index - peak.channel) ** 2) / (2 * peak.width ** 2))
      );
    }, 0);

    return background + peakSignal;
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

function buildFlatDetector(detectorId: string, level: number): DetectorSpectrum {
  const channels = Array.from({ length: 1024 }, () => level);

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

function buildLoadedFile(fileName: string, detector: DetectorSpectrum): LoadedSpcFile {
  return {
    fileName,
    fileSize: detector.channels.length,
    detectorCount: 1,
    detectors: [detector],
  };
}

describe("analyzeSpectrum", () => {
  it("computes the Poisson KL information against background", () => {
    const [information] = computeInformationPerChannel([25], [10], "kl");

    expect(information).toBeCloseTo(35 * Math.log(35 / 10) - 25, 8);
  });

  it("computes Fisher information for mass equal to one", () => {
    const [information] = computeInformationPerChannel([25], [10], "fisher");

    expect(information).toBeCloseTo((25 * 25) / (25 + 10), 8);
  });

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

  it("averages multiple backgrounds for a single source analysis", () => {
    const source = buildLoadedFile(
      "source.txt",
      buildSinglePeakDetector("detector-1", 220),
    );
    const backgroundA = buildLoadedFile(
      "background-a.txt",
      buildFlatDetector("detector-1", 4),
    );
    const backgroundB = buildLoadedFile(
      "background-b.txt",
      buildFlatDetector("detector-1", 6),
    );

    const analysis = analyzeSpectrumSet({
      sourceFiles: [source],
      backgroundFiles: [backgroundA, backgroundB],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(analysis.comparison?.background.channels[12]).toBeCloseTo(5, 5);
    expect(analysis.multiComparison).toBeNull();
    expect(analysis.informationTotals.kl).toBeGreaterThan(0);
    expect(analysis.informationTotals.fisher).toBeCloseTo(
      analysis.comparison?.totalInformation ?? 0,
      8,
    );
  });

  it("detects element peaks instead of background-dominated KL peaks", () => {
    const source = buildLoadedFile(
      "source.txt",
      buildCustomPeakDetector("detector-1", [
        { channel: 612, amplitude: 30, width: 12 },
      ]),
    );
    const background = buildLoadedFile(
      "background.txt",
      buildCustomPeakDetector("detector-1", [
        { channel: 175, amplitude: 800, width: 10 },
      ]),
    );

    const analysis = analyzeSpectrumSet({
      sourceFiles: [source],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 612) < 10)).toBe(
      true,
    );
    expect(
      analysis.rois.some(
        (roi) => roi.startChannel <= 612 && roi.endChannel >= 612,
      ),
    ).toBe(true);
  });

  it("uses channels 200-900 as the working ROI range", () => {
    const source = buildLoadedFile(
      "source.txt",
      buildCustomPeakDetector("detector-1", [
        { channel: 40, amplitude: 180, width: 7 },
        { channel: 612, amplitude: 120, width: 12 },
      ]),
    );
    const background = buildLoadedFile(
      "background.txt",
      buildFlatDetector("detector-1", 5),
    );

    const analysis = analyzeSpectrumSet({
      sourceFiles: [source],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(
      analysis.rois.some(
        (roi) => roi.startChannel <= 40 && roi.endChannel >= 40,
      ),
    ).toBe(false);
    expect(
      analysis.rois.some(
        (roi) => roi.startChannel <= 612 && roi.endChannel >= 612,
      ),
    ).toBe(true);
    expect(analysis.comparison?.infoPerChannel.slice(0, 200).some(Boolean)).toBe(
      false,
    );
  });

  it("can search peaks on the combined element plus background signal", () => {
    const source = buildLoadedFile(
      "source.txt",
      buildFlatDetector("detector-1", 5),
    );
    const background = buildLoadedFile(
      "background.txt",
      buildCustomPeakDetector("detector-1", [
        { channel: 612, amplitude: 150, width: 12 },
      ]),
    );

    const defaultAnalysis = analyzeSpectrumSet({
      sourceFiles: [source],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });
    const combinedAnalysis = analyzeSpectrumSet({
      sourceFiles: [source],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
      peakSearchSignal: "combined",
    });

    expect(
      defaultAnalysis.peaks.some(
        (peak) => Math.abs(peak.refinedChannel - 612) < 10,
      ),
    ).toBe(false);
    expect(
      combinedAnalysis.peaks.some(
        (peak) => Math.abs(peak.refinedChannel - 612) < 10,
      ),
    ).toBe(true);
  });

  it("thresholds combined peak search inside the 200-900 working range", () => {
    const source = buildLoadedFile(
      "source.txt",
      buildFlatDetector("detector-1", 1),
    );
    const background = buildLoadedFile(
      "background.txt",
      buildCustomPeakDetector("detector-1", [
        { channel: 80, amplitude: 1200, width: 18 },
        { channel: 612, amplitude: 80, width: 12 },
      ]),
    );

    const analysis = analyzeSpectrumSet({
      sourceFiles: [source],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
      peakSearchSignal: "combined",
    });

    expect(
      analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 612) < 10),
    ).toBe(true);
    expect(
      analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 80) < 10),
    ).toBe(false);
  });

  it("builds ROIs from differences between multiple element spectra", () => {
    const iron = buildLoadedFile(
      "iron.txt",
      buildSinglePeakDetector("detector-1", 220),
    );
    const copper = buildLoadedFile(
      "copper.txt",
      buildSinglePeakDetector("detector-1", 612),
    );
    const background = buildLoadedFile(
      "background.txt",
      buildFlatDetector("detector-1", 5),
    );

    const analysis = analyzeSpectrumSet({
      sourceFiles: [iron, copper],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(analysis.multiComparison?.sources).toHaveLength(2);
    expect(analysis.multiComparison?.totalInformation).toBeGreaterThan(0);
    expect(analysis.informationTotals.kl).toBeGreaterThan(0);
    expect(analysis.informationTotals.fisher).toBeCloseTo(
      analysis.multiComparison?.totalInformation ?? 0,
      8,
    );
    expect(analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 220) < 8)).toBe(
      true,
    );
    expect(analysis.peaks.some((peak) => Math.abs(peak.refinedChannel - 612) < 10)).toBe(
      true,
    );
    expect(analysis.rois.length).toBeGreaterThanOrEqual(2);
  });

  it("drops common ROIs that are strong against background but do not separate spectra", () => {
    const sharedPeak = { channel: 220, amplitude: 130, width: 11 };
    const sourceA = buildLoadedFile(
      "source-a.txt",
      buildCustomPeakDetector("detector-1", [
        sharedPeak,
        { channel: 612, amplitude: 150, width: 12 },
      ]),
    );
    const sourceB = buildLoadedFile(
      "source-b.txt",
      buildCustomPeakDetector("detector-1", [
        sharedPeak,
        { channel: 612, amplitude: 75, width: 12 },
      ]),
    );
    const sourceC = buildLoadedFile(
      "source-c.txt",
      buildCustomPeakDetector("detector-1", [sharedPeak]),
    );
    const background = buildLoadedFile(
      "background.txt",
      buildFlatDetector("detector-1", 5),
    );

    const analysis = analyzeSpectrumSet({
      sourceFiles: [sourceA, sourceB, sourceC],
      backgroundFiles: [background],
      selectedDetectorIds: ["detector-1"],
      aggregationMode: "mean",
      preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
      peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
      roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
    });

    expect(
      analysis.rois.some(
        (roi) => roi.startChannel <= 220 && roi.endChannel >= 220,
      ),
    ).toBe(false);
    expect(
      analysis.rois.some(
        (roi) => roi.startChannel <= 612 && roi.endChannel >= 612,
      ),
    ).toBe(true);
  });

  it("stops information ROIs after a weak windowed contribution", () => {
    const peakChannel = 60;
    const corrected = Array.from({ length: 121 }, (_, index) => {
      const distance = Math.abs(index - peakChannel);

      if (distance <= 8) {
        return 100 - distance * 9;
      }

      return Math.max(0, 18 - distance);
    });
    const processed: ProcessedSpectrum = {
      raw: corrected,
      smoothed: corrected,
      baseline: new Array(corrected.length).fill(0),
      corrected,
      normalized: corrected,
    };
    const infoPerChannel = corrected.map((value, index) => {
      if (Math.abs(index - peakChannel) <= 8) {
        return value;
      }

      if (index === 82) {
        return 120;
      }

      return 0.001;
    });
    const peak: Peak = {
      id: "peak-1",
      channel: peakChannel,
      refinedChannel: peakChannel,
      value: corrected[peakChannel],
      prominence: corrected[peakChannel],
      widthHint: 16,
      energy: peakChannel,
      source: "auto",
    };
    const result = buildRoisFromInformation(
      [peak],
      processed,
      ["detector-1"],
      infoPerChannel,
      {
        ...DEFAULT_ROI_DETECTION_SETTINGS,
        minChannel: 0,
        maxChannel: corrected.length - 1,
      },
    );

    expect(result.rois).toHaveLength(1);
    expect(result.rois[0].endChannel).toBeLessThan(82);
    expect(result.rois[0].endChannel).toBeLessThanOrEqual(69);
  });
});
