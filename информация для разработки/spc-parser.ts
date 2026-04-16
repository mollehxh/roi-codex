export interface SpectrumHeader {
  time: number;
  height: number;
  coeffB: number;
  flag: number;
}

export interface SpectrumStats {
  sum: number;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  nonZeroCount: number;
  peaks: Array<{ channel: number; value: number; energy: number }>;
  peakCount: number;
}

export interface SpectrumData {
  header: SpectrumHeader;
  mainSpectrum: number[];
  rejectSpectrum: number[];
  stats: SpectrumStats;
  metadata: {
    spSize: number;
    channels: number;
  };
}

export interface ParseResult {
  fileName: string;
  fileSize: number;
  spectraCount: number;
  spectra: SpectrumData[];
}

export interface EnergyCalibration {
  slope: number;
  intercept: number;
}

const DEFAULT_SCALE_MEV = 13;
const DEFAULT_CHANNELS = 1024;

function normalizeInput(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function getView(bytes: Uint8Array, offset: number): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset + offset);
}

function readSpectrumValue(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

export default class SPCFileParser {
  readonly SP_SIZE = DEFAULT_CHANNELS;
  readonly SPECTRUM_SIZE = 6157;
  readonly DEFAULT_CALIBRATION: EnergyCalibration = {
    slope: DEFAULT_SCALE_MEV / (DEFAULT_CHANNELS - 1),
    intercept: 0,
  };

  parseArrayBuffer(buffer: ArrayBuffer, fileName = ""): ParseResult {
    return this.parseBuffer(buffer, fileName);
  }

  parseBuffer(buffer: ArrayBuffer | Uint8Array, fileName = ""): ParseResult {
    const bytes = normalizeInput(buffer);
    const spectra: SpectrumData[] = [];
    let offset = 0;

    if (bytes.length % this.SPECTRUM_SIZE !== 0) {
      console.warn(
        `Размер файла ${bytes.length} не кратен ${this.SPECTRUM_SIZE}`,
      );
    }

    while (offset + this.SPECTRUM_SIZE <= bytes.length) {
      try {
        const spectrum = this.parseSingleSpectrum(bytes, offset);
        spectra.push(spectrum);
        offset += this.SPECTRUM_SIZE;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `Ошибка парсинга спектра на смещении ${offset}:`,
          message,
        );
        break;
      }
    }

    return {
      fileName,
      fileSize: bytes.length,
      spectraCount: spectra.length,
      spectra,
    };
  }

  parseSingleSpectrum(buffer: ArrayBuffer | Uint8Array, offset: number): SpectrumData {
    const bytes = normalizeInput(buffer);

    if (bytes.length - offset < this.SPECTRUM_SIZE) {
      throw new Error("Недостаточно данных для полного спектра");
    }

    const headerView = getView(bytes, offset);
    const time = headerView.getFloat32(0, true);
    const height = headerView.getFloat32(4, true);
    const coeffB = headerView.getFloat32(8, true);
    const flag = headerView.getUint8(12);

    const mainSpectrum = new Array<number>(this.SP_SIZE);
    let dataOffset = offset + 13;

    for (let i = 0; i < this.SP_SIZE; i += 1) {
      mainSpectrum[i] = readSpectrumValue(bytes, dataOffset);
      dataOffset += 3;
    }

    const rejectSpectrum = new Array<number>(this.SP_SIZE);
    for (let i = 0; i < this.SP_SIZE; i += 1) {
      rejectSpectrum[i] = readSpectrumValue(bytes, dataOffset);
      dataOffset += 3;
    }

    const stats = this.calculateStats(
      mainSpectrum,
      this.buildCalibration({ coeffB }),
    );

    return {
      header: {
        time,
        height,
        coeffB,
        flag,
      },
      mainSpectrum,
      rejectSpectrum,
      stats,
      metadata: {
        spSize: this.SP_SIZE,
        channels: this.SP_SIZE,
      },
    };
  }

  buildCalibration(header?: Pick<SpectrumHeader, "coeffB">): EnergyCalibration {
    return {
      slope: this.DEFAULT_CALIBRATION.slope,
      intercept: header?.coeffB ?? this.DEFAULT_CALIBRATION.intercept,
    };
  }

  calculateStats(
    spectrum: number[],
    calibration = this.DEFAULT_CALIBRATION,
  ): SpectrumStats {
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    let nonZeroCount = 0;

    for (const value of spectrum) {
      sum += value;
      max = Math.max(max, value);
      min = Math.min(min, value);
      if (value > 0) {
        nonZeroCount += 1;
      }
    }

    const mean = sum / spectrum.length;

    let variance = 0;
    for (const value of spectrum) {
      variance += (value - mean) ** 2;
    }
    variance /= spectrum.length;

    const peaks = this.findPeaks(spectrum, 5, calibration);

    return {
      sum,
      mean,
      min,
      max,
      stdDev: Math.sqrt(variance),
      nonZeroCount,
      peaks,
      peakCount: peaks.length,
    };
  }

  findPeaks(
    spectrum: number[],
    window = 5,
    calibration = this.DEFAULT_CALIBRATION,
  ): Array<{ channel: number; value: number; energy: number }> {
    const peaks: Array<{ channel: number; value: number; energy: number }> = [];

    for (let i = window; i < spectrum.length - window; i += 1) {
      let isPeak = true;

      for (let j = 1; j <= window; j += 1) {
        if (spectrum[i] <= spectrum[i - j] || spectrum[i] <= spectrum[i + j]) {
          isPeak = false;
          break;
        }
      }

      if (isPeak && spectrum[i] > 0) {
        peaks.push({
          channel: i,
          value: spectrum[i],
          energy: calibration.slope * i + calibration.intercept,
        });
      }
    }

    return peaks;
  }
}
