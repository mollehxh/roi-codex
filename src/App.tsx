import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert, AppShell, Card, Grid, Loader, Stack, Text, Title } from "@mantine/core";
import { analyzeSpectrum } from "./domain/analysis/analyzeSpectrum";
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
  sourceFile: LoadedSpcFile | null,
  backgroundFile: LoadedSpcFile | null,
) {
  if (!sourceFile || !backgroundFile) {
    return [];
  }

  const backgroundIds = new Set(
    backgroundFile.detectors.map((detector) => detector.detectorId),
  );

  return sourceFile.detectors.filter((detector) =>
    backgroundIds.has(detector.detectorId),
  );
}

export default function App() {
  const [sourceFile, setSourceFile] = useState<LoadedSpcFile | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<LoadedSpcFile | null>(null);
  const [selectedDetectorId, setSelectedDetectorId] = useState<string | null>(null);
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(
    DEFAULT_OVERLAY_VISIBILITY,
  );
  const [analysis, setAnalysis] = useState<SpectrumAnalysisResult | null>(null);
  const [selectedRoiId, setSelectedRoiId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingSourceFile, setIsLoadingSourceFile] = useState(false);
  const [isLoadingBackgroundFile, setIsLoadingBackgroundFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commonDetectors = useMemo(
    () => getCommonDetectors(sourceFile, backgroundFile),
    [sourceFile, backgroundFile],
  );

  useEffect(() => {
    if (commonDetectors.length === 0) {
      setSelectedDetectorId(null);
      return;
    }

    if (!selectedDetectorId || !commonDetectors.some((detector) => detector.detectorId === selectedDetectorId)) {
      setSelectedDetectorId(commonDetectors[0]?.detectorId ?? null);
    }
  }, [commonDetectors, selectedDetectorId]);

  useEffect(() => {
    if (!sourceFile || !backgroundFile || !selectedDetectorId) {
      setAnalysis(null);
      return;
    }

    startTransition(() => {
      try {
        setAnalysis(
          analyzeSpectrum({
            detectors: sourceFile.detectors,
            selectedDetectorIds: [selectedDetectorId],
            analysisMode: "comparison",
            backgroundDetectors: backgroundFile.detectors,
            selectedBackgroundDetectorIds: [selectedDetectorId],
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
            : "Ошибка анализа спектра.";
        setError(message);
        setAnalysis(null);
      }
    });
  }, [
    sourceFile,
    backgroundFile,
    selectedDetectorId,
  ]);

  async function handleSourceFileSelected(file: File) {
    setIsLoadingSourceFile(true);
    setError(null);

    try {
      const nextFile = await parseSpectrumFile(file);
      setSourceFile(nextFile);
      setSelectedRoiId(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Не удалось разобрать входной файл.";
      setError(message);
      setSourceFile(null);
      setAnalysis(null);
    } finally {
      setIsLoadingSourceFile(false);
    }
  }

  async function handleBackgroundFileSelected(file: File) {
    setIsLoadingBackgroundFile(true);
    setError(null);

    try {
      const nextFile = await parseSpectrumFile(file);
      setBackgroundFile(nextFile);
      setSelectedRoiId(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Не удалось разобрать входной файл.";
      setError(message);
      setBackgroundFile(null);
      setAnalysis(null);
    } finally {
      setIsLoadingBackgroundFile(false);
    }
  }

  const isLoadingFile = isLoadingSourceFile || isLoadingBackgroundFile;

  return (
    <AppShell padding="md">
      <AppShell.Main>
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FileDropzone
                label="Файл источника"
                description="Основной спектр для анализа ROI. Поддерживаются .spc и .txt."
                fileName={sourceFile?.fileName ?? null}
                onFileSelected={handleSourceFileSelected}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FileDropzone
                label="Файл фона"
                description="Фоновый спектр для вычитания. Поддерживаются .spc и .txt."
                fileName={backgroundFile?.fileName ?? null}
                onFileSelected={handleBackgroundFileSelected}
              />
            </Grid.Col>
          </Grid>

          {error ? <Alert color="red">{error}</Alert> : null}

          {isLoadingFile ? (
            <Card withBorder>
              <Stack align="center" gap="xs" py="md">
                <Loader size="sm" />
                <Text size="sm">Чтение и разбор файла `.spc` или `.txt`</Text>
              </Stack>
            </Card>
          ) : null}

          {sourceFile && backgroundFile ? (
            <Grid gutter="md" align="stretch">
              <Grid.Col span={{ base: 12, xl: 3 }}>
                <Card withBorder>
                  <Stack gap="md">
                    <Title order={5}>Параметры анализа</Title>
                    <DetectorSelector
                      label="Детектор"
                      description="Один и тот же детектор используется и для источника, и для фона."
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
                      Пересчет спектра, пиков и ROI
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
                  Загрузите файл источника и файл фона в формате `.spc` или `.txt`.
                </Text>
              </Stack>
            </Card>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
