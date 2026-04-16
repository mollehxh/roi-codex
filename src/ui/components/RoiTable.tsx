import {
  Badge,
  Card,
  Group,
  ScrollArea,
  Table,
  Text,
} from "@mantine/core";
import type { ROI } from "../../types/spectrum";

interface RoiTableProps {
  rois: ROI[];
  selectedRoiId: string | null;
  onSelect: (roiId: string | null) => void;
}

export function RoiTable({ rois, selectedRoiId, onSelect }: RoiTableProps) {
  return (
    <Card withBorder radius="lg" padding="lg" h="100%">
      <Group justify="space-between" mb="md">
        <div>
          <Text fw={700}>Найденные ROI</Text>
          <Text size="sm" c="dimmed">
            Канальные границы и score для последующего МНК.
          </Text>
        </div>
        <Badge variant="light" color="blue">
          {rois.length}
        </Badge>
      </Group>
      <ScrollArea h={420}>
        <Table striped highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ROI</Table.Th>
              <Table.Th>Start</Table.Th>
              <Table.Th>End</Table.Th>
              <Table.Th>Center</Table.Th>
              <Table.Th>Width</Table.Th>
              <Table.Th>Score</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rois.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    ROI пока не найдены.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rois.map((roi) => {
                const selected = roi.id === selectedRoiId;
                return (
                  <Table.Tr
                    key={roi.id}
                    bg={selected ? "blue.0" : undefined}
                    onMouseEnter={() => onSelect(roi.id)}
                    onMouseLeave={() => onSelect(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>{roi.id}</Table.Td>
                    <Table.Td>{roi.startChannel}</Table.Td>
                    <Table.Td>{roi.endChannel}</Table.Td>
                    <Table.Td>{roi.peakChannel.toFixed(2)}</Table.Td>
                    <Table.Td>{roi.width}</Table.Td>
                    <Table.Td>{roi.score.toFixed(4)}</Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
