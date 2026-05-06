import { Group, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";

interface FileDropzoneProps {
  label: string;
  fileNames: string[];
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
}

export function FileDropzone({
  label,
  fileNames,
  maxFiles,
  onFilesSelected,
}: FileDropzoneProps) {
  const fileLabel =
    fileNames.length === 0
      ? "Файл не выбран"
      : fileNames.length === 1
        ? fileNames[0]
        : `${fileNames.length} файлов`;

  return (
    <Dropzone
      w={{ base: "100%", sm: 260 }}
      p="xs"
      maxFiles={maxFiles}
      accept={[".spc", ".txt", "text/plain"]}
      onDrop={(files) => onFilesSelected(files)}
    >
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={700}>{label}</Text>
        <Text size="sm" truncate>
          {fileLabel}
        </Text>
      </Group>
    </Dropzone>
  );
}
