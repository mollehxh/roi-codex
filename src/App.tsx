import { useEffect, useState, useTransition } from "react";
import {
  Alert,
  AppShell,
  Badge,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { AlertTriangle, Cpu, Radar } from "lucide-react";
import { analyzeSpectrum } from "./domain/analysis/analyzeSpectrum";
import { parseSpcFile } from "./shared/spc/parseSpcFile";
import {
  DEFAULT_OVERLAY_VISIBILITY,
  DEFAULT_PEAK_DETECTION_SETTINGS,
  DEFAULT_PREPROCESSING_SETTINGS,
  DEFAULT_ROI_DETECTION_SETTINGS,
  type AggregationMode,
  type LoadedSpcFile,
  type OverlayVisibility,
  type PeakDetectionSettings,
  type PreprocessingSettings,
  type RoiDetectionSettings,
  type SpectrumAnalysisResult,
} from "./types/spectrum";
import { DetectorSelector } from "./ui/components/DetectorSelector";
import { FileDropzone } from "./ui/components/FileDropzone";
import { ProcessingSettingsPanel } from "./ui/components/ProcessingSettingsPanel";
import { RoiSettingsPanel } from "./ui/components/RoiSettingsPanel";
import { RoiTable } from "./ui/components/RoiTable";
import { SpectrumChart } from "./ui/components/SpectrumChart";
import { SummaryStats } from "./ui/components/SummaryStats";

const AGGREGATION_MODE: AggregationMode = "mean";

export default function App() {
  const [loadedFile, setLoadedFile] = useState<LoadedSpcFile | null>(null);
  const [selectedDetectorIds, setSelectedDetectorIds] = useState<string[]>([]);
  const [preprocessingSettings, setPreprocessingSettings] =
    useState<PreprocessingSettings>(DEFAULT_PREPROCESSING_SETTINGS);
  const [peakSettings, setPeakSettings] = useState<PeakDetectionSettings>(
    DEFAULT_PEAK_DETECTION_SETTINGS,
  );
  const [roiSettings, setRoiSettings] = useState<RoiDetectionSettings>(
    DEFAULT_ROI_DETECTION_SETTINGS,
  );
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(
    DEFAULT_OVERLAY_VISIBILITY,
  );
  const [analysis, setAnalysis] = useState<SpectrumAnalysisResult | null>(null);
  const [selectedRoiId, setSelectedRoiId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadedFile || selectedDetectorIds.length === 0) {
      setAnalysis(null);
      return;
    }

    startTransition(() => {
      try {
        setAnalysis(
          analyzeSpectrum({
            detectors: loadedFile.detectors,
            selectedDetectorIds,
            aggregationMode: AGGREGATION_MODE,
            preprocessingSettings,
            peakDetectionSettings: peakSettings,
            roiDetectionSettings: roiSettings,
          }),
        );
        setError(null);
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : "Ошибка анализа спектра.";
        setError(message);
        setAnalysis(null);
      }
    });
  }, [
    loadedFile,
    selectedDetectorIds,
    preprocessingSettings,
    peakSettings,
    roiSettings,
  ]);

  async function handleFileSelected(file: File) {
    setIsLoadingFile(true);
    setError(null);

    try {
      const nextFile = await parseSpcFile(file);
      setLoadedFile(nextFile);
      setSelectedDetectorIds(nextFile.detectors.map((detector) => detector.detectorId));
      setSelectedRoiId(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Не удалось распарсить .spc.";
      setError(message);
      setLoadedFile(null);
      setAnalysis(null);
    } finally {
      setIsLoadingFile(false);
    }
  }

  return (
    <AppShell
      padding="lg"
      header={{ height: 96 }}
      styles={{
        main: {
          background: "transparent",
        },
      }}
    >
      <AppShell.Header px="lg" py="md" bg="rgba(244, 247, 251, 0.82)">
        <Group justify="space-between" align="center" h="100%">
          <div>
            <Group gap="xs" mb={4}>
              <Badge variant="light" color="blue" size="lg">
                SPC ROI Analyzer
              </Badge>
              <Badge variant="dot" color="gray">
                MVP
              </Badge>
            </Group>
            <Title order={2}>Автоматический поиск ROI по одному спектру</Title>
          </div>
          <Group gap="xl">
            <Group gap="xs">
              <Cpu size={18} />
              <Text size="sm">Mantine UI</Text>
            </Group>
            <Group gap="xs">
              <Radar size={18} />
              <Text size="sm">Peak-centric ROI</Text>
            </Group>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Stack gap="lg">
          <FileDropzone
            fileName={loadedFile?.fileName ?? null}
            onFileSelected={handleFileSelected}
          />

          {error ? (
            <Alert color="red" icon={<AlertTriangle size={18} />} variant="light">
              {error}
            </Alert>
          ) : null}

          {isLoadingFile ? (
            <Card withBorder radius="lg" padding="xl">
              <Group justify="center" py="xl">
                <Loader />
                <Text>Чтение и парсинг `.spc`...</Text>
              </Group>
            </Card>
          ) : null}

          {loadedFile ? (
            <Grid gutter="lg" align="stretch">
              <Grid.Col span={{ base: 12, xl: 3 }}>
                <Card withBorder radius="lg" padding="lg">
                  <Stack gap="md">
                    <div>
                      <Text fw={700}>Настройки анализа</Text>
                      <Text size="sm" c="dimmed">
                        Детекторы, preprocessing и параметры ROI.
                      </Text>
                    </div>
                    <DetectorSelector
                      detectors={loadedFile.detectors}
                      value={selectedDetectorIds}
                      onChange={setSelectedDetectorIds}
                    />
                    <Divider />
                    <ProcessingSettingsPanel
                      value={preprocessingSettings}
                      onChange={setPreprocessingSettings}
                    />
                    <Divider />
                    <RoiSettingsPanel
                      peakSettings={peakSettings}
                      roiSettings={roiSettings}
                      overlayVisibility={overlayVisibility}
                      onPeakSettingsChange={setPeakSettings}
                      onRoiSettingsChange={setRoiSettings}
                      onOverlayVisibilityChange={setOverlayVisibility}
                    />
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 9 }}>
                <Stack gap="lg">
                  {analysis ? <SummaryStats analysis={analysis} /> : null}

                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, xxl: 8 }}>
                      <SpectrumChart
                        rawChannels={analysis?.aggregated.channels ?? []}
                        displayChannels={analysis?.processed.corrected ?? []}
                        peaks={analysis?.peaks ?? []}
                        rois={analysis?.rois ?? []}
                        showPeaks={overlayVisibility.showPeaks}
                        showRoi={overlayVisibility.showRoi}
                        selectedRoiId={selectedRoiId}
                        onSelectRoi={setSelectedRoiId}
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
                      Пересчет preprocessing, пиков и ROI...
                    </Text>
                  ) : null}
                </Stack>
              </Grid.Col>
            </Grid>
          ) : (
            <Card withBorder radius="lg" padding="xl">
              <Stack gap="xs">
                <Text fw={700}>Нет загруженного спектра</Text>
                <Text size="sm" c="dimmed">
                  Загрузите `.spc`, выберите детекторы и приложение построит итоговый
                  спектр, выполнит preprocessing, найдет пики и автоматически предложит
                  ROI для последующего МНК.
                </Text>
              </Stack>
            </Card>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
