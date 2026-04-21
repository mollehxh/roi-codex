import { Stack, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";

interface FileDropzoneProps {
  label: string;
  description: string;
  fileNames: string[];
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
}

export function FileDropzone({
  label,
  description,
  fileNames,
  maxFiles,
  onFilesSelected,
}: FileDropzoneProps) {
  return (
    <Dropzone
      maxFiles={maxFiles}
      accept={[".spc", ".txt", "text/plain"]}
      onDrop={(files) => onFilesSelected(files)}
    >
      <Stack gap={4}>
        <Text fw={500}>{label}</Text>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        <Text size="sm" c="dimmed">
          Текущие файлы: {fileNames.length > 0 ? fileNames.join(", ") : "не выбраны"}
        </Text>
      </Stack>
    </Dropzone>
  );
}
