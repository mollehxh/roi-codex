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
  const totalWidth = rois.reduce((sum, roi) => sum + roi.width, 0);

  return (
    <Card withBorder h="100%">
      <Title order={5} mb="xs">
        Список ROI
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Найдено: {rois.length}; суммарная информация: {totalInformation.toFixed(6)}
      </Text>

      <ScrollArea h={420}>
        <Table striped highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ROI</Table.Th>
              <Table.Th>Начало</Table.Th>
              <Table.Th>Конец</Table.Th>
              <Table.Th>Ширина</Table.Th>
              <Table.Th>Информация</Table.Th>
              <Table.Th>Доля</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rois.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    ROI не найдены.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              <>
                {rois.map((roi) => {
                  const selected = roi.id === selectedRoiId;

                  return (
                    <Table.Tr
                      key={roi.id}
                      bg={selected ? "var(--mantine-color-gray-1)" : undefined}
                      onMouseEnter={() => onSelect(roi.id)}
                      onMouseLeave={() => onSelect(null)}
                    >
                      <Table.Td>{roi.id}</Table.Td>
                      <Table.Td>{roi.startChannel}</Table.Td>
                      <Table.Td>{roi.endChannel}</Table.Td>
                      <Table.Td>{roi.width}</Table.Td>
                      <Table.Td>{roi.information.toFixed(6)}</Table.Td>
                      <Table.Td>{(roi.informationFraction * 100).toFixed(2)}%</Table.Td>
                    </Table.Tr>
                  );
                })}
                <Table.Tr fw={700}>
                  <Table.Td>Итого</Table.Td>
                  <Table.Td>-</Table.Td>
                  <Table.Td>-</Table.Td>
                  <Table.Td>{totalWidth}</Table.Td>
                  <Table.Td>{totalInformation.toFixed(6)}</Table.Td>
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
