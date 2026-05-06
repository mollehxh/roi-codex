import { Card, ScrollArea, Table, Text, Title } from "@mantine/core";
import type { ROI } from "../../types/spectrum";

interface RoiTableProps {
  rois: ROI[];
  selectedRoiId: string | null;
  onSelect: (roiId: string | null) => void;
}

export function RoiTable({ rois, selectedRoiId, onSelect }: RoiTableProps) {
  const totalInformation = rois.reduce(
    (sum, roi) => sum + roi.information,
    0,
  );
  const totalInformationFraction = rois.reduce(
    (sum, roi) => sum + roi.informationFraction,
    0,
  );
  return (
    <Card withBorder h="100%">
      <Title order={5} mb="sm">
        ROI зоны
      </Title>

      <ScrollArea h={560}>
        <Table
          highlightOnHover
          horizontalSpacing="md"
          verticalSpacing="sm"
          withTableBorder={false}
          withColumnBorders={false}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Зона</Table.Th>
              <Table.Th>Диапазон (каналы)</Table.Th>
              <Table.Th>Вес (инт.)</Table.Th>
              <Table.Th>Доля</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rois.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed">
                    ROI не найдены.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              <>
                {rois.map((roi, index) => {
                  const selected = roi.id === selectedRoiId;
                  const roiNumber = roi.id.match(/\d+$/)?.[0] ?? String(index + 1);

                  return (
                    <Table.Tr
                      key={roi.id}
                      bg={selected ? "var(--mantine-color-blue-0)" : undefined}
                      onMouseEnter={() => onSelect(roi.id)}
                      onMouseLeave={() => onSelect(null)}
                    >
                      <Table.Td>{roiNumber}</Table.Td>
                      <Table.Td>
                        <Text fw={500}>{roi.id}</Text>
                      </Table.Td>
                      <Table.Td>
                        {roi.startChannel} - {roi.endChannel}
                      </Table.Td>
                      <Table.Td>{roi.information.toFixed(3)}</Table.Td>
                      <Table.Td>{(roi.informationFraction * 100).toFixed(2)}%</Table.Td>
                    </Table.Tr>
                  );
                })}
                <Table.Tr fw={700}>
                  <Table.Td>Итого</Table.Td>
                  <Table.Td>-</Table.Td>
                  <Table.Td />
                  <Table.Td>{totalInformation.toFixed(3)}</Table.Td>
                  <Table.Td>{(totalInformationFraction * 100).toFixed(2)}%</Table.Td>
                </Table.Tr>
              </>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
