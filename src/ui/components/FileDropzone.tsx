import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { FileArchive, Upload } from "lucide-react";

interface FileDropzoneProps {
  fileName: string | null;
  onFileSelected: (file: File) => void;
}

export function FileDropzone({ fileName, onFileSelected }: FileDropzoneProps) {
  return (
    <Dropzone
      maxFiles={1}
      onDrop={(files) => {
        const file = files[0];
        if (file) {
          onFileSelected(file);
        }
      }}
      radius="md"
      styles={{
        root: {
          borderColor: "var(--mantine-color-blue-4)",
          background:
            "linear-gradient(135deg, rgba(9,53,99,0.04), rgba(35,138,255,0.12))",
        },
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap">
          <ThemeIcon size={52} radius="md" variant="light" color="blue">
            <Upload size={28} />
          </ThemeIcon>
          <Stack gap={2}>
            <Text fw={600}>Загрузка `.spc`</Text>
            <Text size="sm" c="dimmed">
              Перетащите файл сюда или кликните для выбора. Анализируется один файл за раз.
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size={36} radius="xl" variant="light" color="gray">
            <FileArchive size={18} />
          </ThemeIcon>
          <Text size="sm" c="dimmed" maw={240} truncate="end">
            {fileName ?? "Файл не выбран"}
          </Text>
        </Group>
      </Group>
    </Dropzone>
  );
}
