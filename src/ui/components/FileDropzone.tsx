import { Stack, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";

interface FileDropzoneProps {
  label: string;
  description: string;
  fileName: string | null;
  onFileSelected: (file: File) => void;
}

export function FileDropzone({
  label,
  description,
  fileName,
  onFileSelected,
}: FileDropzoneProps) {
  return (
    <Dropzone
      maxFiles={1}
      accept={[".spc", ".txt", "text/plain"]}
      onDrop={(files) => {
        const file = files[0];
        if (file) {
          onFileSelected(file);
        }
      }}
    >
      <Stack gap={4}>
        <Text fw={500}>{label}</Text>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        <Text size="sm" c="dimmed">
          Текущий файл: {fileName ?? "не выбран"}
        </Text>
      </Stack>
    </Dropzone>
  );
}
