import SPCFileParser from "../../../информация для разработки/spc-parser";
import type { LoadedSpcFile } from "../../types/spectrum";

const parser = new SPCFileParser();

function buildTxtResult(file: File, columns: number[][]): LoadedSpcFile {
  return {
    fileName: file.name,
    fileSize: file.size,
    detectorCount: columns.length,
    detectors: columns.map((channels, index) => ({
      detectorId: `detector-${index + 1}`,
      name: `Detector ${index + 1}`,
      header: {
        time: 0,
        height: 0,
        coeffB: 0,
        flag: 0,
      },
      channels,
      rejectChannels: new Array(channels.length).fill(0),
      calibration: {
        slope: 1,
        intercept: 0,
      },
    })),
  };
}

function parseTxtContent(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("TXT файл пуст.");
  }

  const rows = lines.map((line, index) => {
    const values = line
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((value) => Number.parseFloat(value));

    if (values.length === 0 || values.some((value) => Number.isNaN(value))) {
      throw new Error(`Не удалось разобрать строку ${index + 1} в TXT файле.`);
    }

    return values;
  });

  const columnCount = rows[0].length;
  if (columnCount === 0) {
    throw new Error("TXT файл не содержит числовых колонок.");
  }

  if (rows.some((row) => row.length !== columnCount)) {
    throw new Error("Во всех строках TXT файла должно быть одинаковое число колонок.");
  }

  const columns = Array.from({ length: columnCount }, () => new Array<number>());

  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      columns[index].push(row[index]);
    }
  }

  return columns;
}

export async function parseSpectrumFile(file: File): Promise<LoadedSpcFile> {
  const extension = file.name.toLowerCase().split(".").pop();

  if (extension === "txt") {
    const text =
      typeof file.text === "function"
        ? await file.text()
        : new TextDecoder().decode(await file.arrayBuffer());
    return buildTxtResult(file, parseTxtContent(text));
  }

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

export async function parseSpcFile(file: File): Promise<LoadedSpcFile> {
  return parseSpectrumFile(file);
}

export function energyFromChannel(channel: number, slope: number, intercept: number) {
  return slope * channel + intercept;
}
