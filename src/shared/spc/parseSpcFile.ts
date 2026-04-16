import SPCFileParser from "../../../информация для разработки/spc-parser";
import type { LoadedSpcFile } from "../../types/spectrum";

const parser = new SPCFileParser();

export async function parseSpcFile(file: File): Promise<LoadedSpcFile> {
  const buffer = await file.arrayBuffer();
  const result = parser.parseArrayBuffer(buffer, file.name);

  return {
    fileName: result.fileName,
    fileSize: result.fileSize,
    detectorCount: result.spectraCount,
    detectors: result.spectra.map((spectrum, index) => ({
      detectorId: `detector-${index + 1}`,
      name: `Detector ${index + 1}`,
      header: spectrum.header,
      channels: spectrum.mainSpectrum,
      rejectChannels: spectrum.rejectSpectrum,
      calibration: parser.buildCalibration({
        coeffB: spectrum.header.coeffB,
      }),
    })),
  };
}

export function energyFromChannel(channel: number, slope: number, intercept: number) {
  return slope * channel + intercept;
}
