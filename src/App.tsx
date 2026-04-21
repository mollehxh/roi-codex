import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert, AppShell, Card, Grid, Loader, Stack, Text, Title } from "@mantine/core";
import { analyzeSpectrumSet } from "./domain/analysis/analyzeSpectrumSet";
import { parseSpectrumFile } from "./shared/spc/parseSpcFile";
import {
  DEFAULT_OVERLAY_VISIBILITY,
  DEFAULT_PEAK_DETECTION_SETTINGS,
  DEFAULT_PREPROCESSING_SETTINGS,
  DEFAULT_ROI_DETECTION_SETTINGS,
  type AggregationMode,
  type LoadedSpcFile,
  type OverlayVisibility,
  type SpectrumAnalysisResult,
} from "./types/spectrum";
import { DetectorSelector } from "./ui/components/DetectorSelector";
import { FileDropzone } from "./ui/components/FileDropzone";
import { RoiSettingsPanel } from "./ui/components/RoiSettingsPanel";
import { RoiTable } from "./ui/components/RoiTable";
import { SpectrumChart } from "./ui/components/SpectrumChart";
import { SummaryStats } from "./ui/components/SummaryStats";

const AGGREGATION_MODE: AggregationMode = "mean";

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
    const fileIds = new Set(file.detectors.map((detector) => detector.detectorId));
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

export default function App() {
  const [sourceFiles, setSourceFiles] = useState<LoadedSpcFile[]>([]);
  const [backgroundFiles, setBackgroundFiles] = useState<LoadedSpcFile[]>([]);
  const [selectedDetectorId, setSelectedDetectorId] = useState<string | null>(null);
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(
    DEFAULT_OVERLAY_VISIBILITY,
  );
  const [analysis, setAnalysis] = useState<SpectrumAnalysisResult | null>(null);
  const [selectedRoiId, setSelectedRoiId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingSourceFiles, setIsLoadingSourceFiles] = useState(false);
  const [isLoadingBackgroundFiles, setIsLoadingBackgroundFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commonDetectors = useMemo(
    () => getCommonDetectors(sourceFiles, backgroundFiles),
    [sourceFiles, backgroundFiles],
  );

  useEffect(() => {
    if (commonDetectors.length === 0) {
      setSelectedDetectorId(null);
      return;
    }

    if (
      !selectedDetectorId ||
      !commonDetectors.some((detector) => detector.detectorId === selectedDetectorId)
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
  }, [
    sourceFiles,
    backgroundFiles,
    selectedDetectorId,
  ]);

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
  const analysisModeLabel =
    sourceFiles.length > 1
      ? "Различение спектров элементов"
      : "Сравнение источника с фоном";

  return (
    <AppShell padding="md">
      <AppShell.Main>
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FileDropzone
                label="Спектры элементов"
                description="Один или несколько спектров источников для поиска различающих ROI. Поддерживаются .spc и .txt."
                fileNames={sourceFiles.map((file) => file.fileName)}
                maxFiles={20}
                onFilesSelected={handleSourceFilesSelected}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FileDropzone
                label="Спектры фона"
                description="Один или несколько фоновых спектров; при анализе они усредняются. Поддерживаются .spc и .txt."
                fileNames={backgroundFiles.map((file) => file.fileName)}
                maxFiles={20}
                onFilesSelected={handleBackgroundFilesSelected}
              />
            </Grid.Col>
          </Grid>

          {error ? <Alert color="red">{error}</Alert> : null}

          {isLoadingFile ? (
            <Card withBorder>
              <Stack align="center" gap="xs" py="md">
                <Loader size="sm" />
                <Text size="sm">Чтение и разбор файлов `.spc` или `.txt`</Text>
              </Stack>
            </Card>
          ) : null}

          {hasInputFiles ? (
            <Grid gutter="md" align="stretch">
              <Grid.Col span={{ base: 12, xl: 3 }}>
                <Card withBorder>
                  <Stack gap="md">
                    <Title order={5}>Параметры анализа</Title>
                    <Text size="sm" c="dimmed">
                      {analysisModeLabel}. Источников: {sourceFiles.length}; фонов: {backgroundFiles.length}.
                    </Text>
                    <DetectorSelector
                      label="Детектор"
                      description="Используется детектор, который есть во всех загруженных спектрах."
                      detectors={commonDetectors}
                      value={selectedDetectorId}
                      onChange={(value) => {
                        setSelectedDetectorId(value);
                        setSelectedRoiId(null);
                      }}
                    />
                    <RoiSettingsPanel
                      overlayVisibility={overlayVisibility}
                      onOverlayVisibilityChange={setOverlayVisibility}
                    />
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 9 }}>
                <Stack gap="md">
                  {analysis ? <SummaryStats analysis={analysis} /> : null}

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, xxl: 8 }}>
                      <SpectrumChart
                        rawChannels={analysis?.aggregated.channels ?? []}
                        displayChannels={analysis?.processed.corrected ?? []}
                        peaks={analysis?.peaks ?? []}
                        rois={analysis?.rois ?? []}
                        comparison={analysis?.comparison ?? null}
                        multiComparison={analysis?.multiComparison ?? null}
                        showPeaks={overlayVisibility.showPeaks}
                        showRoi={overlayVisibility.showRoi}
                        selectedRoiId={selectedRoiId}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, xxl: 4 }}>
                      <RoiTable
                        rois={analysis?.rois ?? []}
                        selectedRoiId={selectedRoiId}
                        onSelect={setSelectedRoiId}
                      />
                    </Grid.Col>
                  </Grid>

                  {isPending ? (
                    <Text size="sm" c="dimmed">
                      Пересчет спектров, пиков и ROI
                    </Text>
                  ) : null}
                </Stack>
              </Grid.Col>
            </Grid>
          ) : (
            <Card withBorder>
              <Stack gap="xs">
                <Title order={5}>Данные не загружены</Title>
                <Text size="sm" c="dimmed">
                  Загрузите спектры элементов и хотя бы один фон в формате `.spc` или `.txt`.
                </Text>
              </Stack>
            </Card>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
