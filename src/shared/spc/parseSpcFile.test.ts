import { describe, expect, it } from "vitest";
import { parseSpectrumFile } from "./parseSpcFile";

describe("parseSpectrumFile", () => {
  it("parses txt spectra with one detector per column", async () => {
    const content =
      "1.0E-01 2.0E-01 3.0E-01 4.0E-01\n" +
      "1.1E-01 2.1E-01 3.1E-01 4.1E-01\n" +
      "1.2E-01 2.2E-01 3.2E-01 4.2E-01\n";
    const file = new File(
      [content],
      "_Fe-2.txt",
      { type: "text/plain" },
    );
    Object.assign(file, {
      text: async () => content,
    });

    const result = await parseSpectrumFile(file);

    expect(result.detectorCount).toBe(4);
    expect(result.detectors[0].channels).toEqual([0.1, 0.11, 0.12]);
    expect(result.detectors[3].channels).toEqual([0.4, 0.41, 0.42]);
  });
});
