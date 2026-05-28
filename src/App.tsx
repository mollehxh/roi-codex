import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Alert,
  Card,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { analyzeSpectrumSet } from "./domain/analysis/analyzeSpectrumSet";
import { parseSpectrumFile } from "./shared/spc/parseSpcFile";
import {
  DEFAULT_OVERLAY_VISIBILITY,
  DEFAULT_PEAK_DETECTION_SETTINGS,
  DEFAULT_PREPROCESSING_SETTINGS,
  DEFAULT_ROI_DETECTION_SETTINGS,
  type AggregationMode,
  type LoadedSpcFile,
  type SpectrumAnalysisResult,
} from "./types/spectrum";
import { FileDropzone } from "./ui/components/FileDropzone";
import { RoiTable } from "./ui/components/RoiTable";
import { SpectrumChart } from "./ui/components/SpectrumChart";

const AGGREGATION_MODE: AggregationMode = "mean";
const PRELOAD_DATASET = import.meta.env.VITE_PRELOAD_DATASET;
const DEMO_SOURCE_FILES = [
  { url: "/demo/source/_Fe_.txt", name: "_Fe_.txt" },
];
const DEMO_BACKGROUND_FILES = [
  { url: "/demo/background/_s1_.txt", name: "_s1_.txt" },
];

function getCommonDetectors(
  sourceFiles: LoadedSpcFile[],
  backgroundFiles: LoadedSpcFile[],
) {
  if (sourceFiles.length === 0 || backgroundFiles.length === 0) {
    return [];
  }

  const files = [...sourceFiles, ...backgroundFiles];
  let commonIds = new Set(
    files[0].detectors.map((detector) => detector.detectorId),
  );

  for (const file of files.slice(1)) {
    const fileIds = new Set(
      file.detectors.map((detector) => detector.detectorId),
    );
    commonIds = new Set(
      [...commonIds].filter((detectorId) => fileIds.has(detectorId)),
    );
  }

  return files[0].detectors.filter((detector) =>
    commonIds.has(detector.detectorId),
  );
}

async function parseSpectrumFiles(files: File[]) {
  return Promise.all(files.map((file) => parseSpectrumFile(file)));
}

async function fetchDemoFile(file: { url: string; name: string }) {
  const response = await fetch(file.url);

  if (!response.ok) {
    throw new Error(`Не удалось загрузить demo-файл ${file.name}.`);
  }

  return new File([await response.blob()], file.name, {
    type: "text/plain",
  });
}

export default function App() {
  const [sourceFiles, setSourceFiles] = useState<LoadedSpcFile[]>([]);
  const [backgroundFiles, setBackgroundFiles] = useState<LoadedSpcFile[]>([]);
  const [selectedDetectorId, setSelectedDetectorId] = useState<string | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<SpectrumAnalysisResult | null>(null);
  const [selectedRoiId, setSelectedRoiId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingSourceFiles, setIsLoadingSourceFiles] = useState(false);
  const [isLoadingBackgroundFiles, setIsLoadingBackgroundFiles] =
    useState(false);
  const [error, setError] = useState<string | null>(null);

  const commonDetectors = useMemo(
    () => getCommonDetectors(sourceFiles, backgroundFiles),
    [sourceFiles, backgroundFiles],
  );
  const detectorOptions = useMemo(
    () =>
      commonDetectors.map((detector) => ({
        value: detector.detectorId,
        label: detector.name,
      })),
    [commonDetectors],
  );

  useEffect(() => {
    if (PRELOAD_DATASET !== "demo") {
      return;
    }

    let canceled = false;

    async function preloadDemoFiles() {
      setIsLoadingSourceFiles(true);
      setIsLoadingBackgroundFiles(true);
      setError(null);

      try {
        const [sourceDemoFiles, backgroundDemoFiles] = await Promise.all([
          Promise.all(DEMO_SOURCE_FILES.map(fetchDemoFile)),
          Promise.all(DEMO_BACKGROUND_FILES.map(fetchDemoFile)),
        ]);
        const [nextSourceFiles, nextBackgroundFiles] = await Promise.all([
          parseSpectrumFiles(sourceDemoFiles),
          parseSpectrumFiles(backgroundDemoFiles),
        ]);

        if (canceled) {
          return;
        }

        setSourceFiles(nextSourceFiles);
        setBackgroundFiles(nextBackgroundFiles);
        setSelectedRoiId(null);
      } catch (nextError) {
        if (canceled) {
          return;
        }

        const message =
          nextError instanceof Error
            ? nextError.message
            : "Не удалось загрузить demo-файлы.";
        setError(message);
        setSourceFiles([]);
        setBackgroundFiles([]);
        setAnalysis(null);
      } finally {
        if (!canceled) {
          setIsLoadingSourceFiles(false);
          setIsLoadingBackgroundFiles(false);
        }
      }
    }

    void preloadDemoFiles();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (commonDetectors.length === 0) {
      setSelectedDetectorId(null);
      return;
    }

    if (
      !selectedDetectorId ||
      !commonDetectors.some(
        (detector) => detector.detectorId === selectedDetectorId,
      )
    ) {
      setSelectedDetectorId(commonDetectors[0]?.detectorId ?? null);
    }
  }, [commonDetectors, selectedDetectorId]);

  useEffect(() => {
    if (
      sourceFiles.length === 0 ||
      backgroundFiles.length === 0 ||
      !selectedDetectorId
    ) {
      setAnalysis(null);
      return;
    }

    startTransition(() => {
      try {
        setAnalysis(
          analyzeSpectrumSet({
            sourceFiles,
            backgroundFiles,
            selectedDetectorIds: [selectedDetectorId],
            aggregationMode: AGGREGATION_MODE,
            preprocessingSettings: DEFAULT_PREPROCESSING_SETTINGS,
            peakDetectionSettings: DEFAULT_PEAK_DETECTION_SETTINGS,
            roiDetectionSettings: DEFAULT_ROI_DETECTION_SETTINGS,
            informationMetric: "fisher",
          }),
        );
        setError(null);
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Ошибка анализа спектров.";
        setError(message);
        setAnalysis(null);
      }
    });
  }, [sourceFiles, backgroundFiles, selectedDetectorId]);

  async function handleSourceFilesSelected(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsLoadingSourceFiles(true);
    setError(null);

    try {
      const nextFiles = await parseSpectrumFiles(files);
      setSourceFiles(nextFiles);
      setSelectedRoiId(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Не удалось разобрать входные файлы.";
      setError(message);
      setSourceFiles([]);
      setAnalysis(null);
    } finally {
      setIsLoadingSourceFiles(false);
    }
  }

  async function handleBackgroundFilesSelected(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsLoadingBackgroundFiles(true);
    setError(null);

    try {
      const nextFiles = await parseSpectrumFiles(files);
      setBackgroundFiles(nextFiles);
      setSelectedRoiId(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Не удалось разобрать входные файлы.";
      setError(message);
      setBackgroundFiles([]);
      setAnalysis(null);
    } finally {
      setIsLoadingBackgroundFiles(false);
    }
  }

  const isLoadingFile = isLoadingSourceFiles || isLoadingBackgroundFiles;
  const hasInputFiles = sourceFiles.length > 0 && backgroundFiles.length > 0;
  const informationTotals = analysis?.informationTotals ?? {
    kl: 0,
    fisher: 0,
  };

  return (
    <Stack gap="sm" p="sm">
      <Group gap="xs">
        <FileDropzone
          label="Элемент:"
          fileNames={sourceFiles.map((file) => file.fileName)}
          maxFiles={20}
          onFilesSelected={handleSourceFilesSelected}
        />
        <FileDropzone
          label="Фон:"
          fileNames={backgroundFiles.map((file) => file.fileName)}
          maxFiles={20}
          onFilesSelected={handleBackgroundFilesSelected}
        />
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={700}>
            Детектор:
          </Text>
          <Select
            size="sm"
            w={160}
            data={detectorOptions}
            value={selectedDetectorId}
            onChange={(value) => {
              setSelectedDetectorId(value);
              setSelectedRoiId(null);
            }}
            searchable
            allowDeselect={false}
            disabled={detectorOptions.length === 0}
            placeholder="Детектор"
            nothingFoundMessage="Нет детекторов"
          />
        </Group>
      </Group>

      {error ? <Alert color="red">{error}</Alert> : null}

      {isLoadingFile ? (
        <Card withBorder>
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Чтение файлов</Text>
          </Group>
        </Card>
      ) : null}

      {hasInputFiles ? (
        <>
          <Grid gutter="sm" align="stretch">
            <Grid.Col span={{ base: 12, lg: 9 }}>
              <SpectrumChart
                rawChannels={analysis?.aggregated.channels ?? []}
                displayChannels={analysis?.processed.corrected ?? []}
                peaks={analysis?.peaks ?? []}
                rois={analysis?.rois ?? []}
                comparison={analysis?.comparison ?? null}
                multiComparison={analysis?.multiComparison ?? null}
                showPeaks={DEFAULT_OVERLAY_VISIBILITY.showPeaks}
                showRoi={DEFAULT_OVERLAY_VISIBILITY.showRoi}
                selectedRoiId={selectedRoiId}
                informationTotals={informationTotals}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 3 }}>
              <RoiTable
                rois={analysis?.rois ?? []}
                selectedRoiId={selectedRoiId}
                onSelect={setSelectedRoiId}
              />
            </Grid.Col>
          </Grid>
          {isPending ? (
            <Text size="sm" c="dimmed">
              Пересчет ROI
            </Text>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
