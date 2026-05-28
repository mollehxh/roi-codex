import { Card, ScrollArea, Table, Text, Title } from "@mantine/core";
import type { ROI } from "../../types/spectrum";

const CALIBRATION_KEV_PER_CHANNEL = 12.695;
const CEMENT_PEAKS_E = {
  H: 2223.0,
  Si: 1779.0,
  Ca: 1943.0,
  S: 5421.0,
  K: 5380.0,
  Na: 6395.0,
  Fe: 7631.0,
  Al: 7724.0,
  Cl: 6111.0,
} as const;
const ELEMENT_MATCH_TOLERANCE_KEV = CALIBRATION_KEV_PER_CHANNEL * 2;

interface RoiTableProps {
  rois: ROI[];
  selectedRoiId: string | null;
  onSelect: (roiId: string | null) => void;
}

function resolveRoiLabel(roi: ROI) {
  const peakEnergy = roi.peakChannel * CALIBRATION_KEV_PER_CHANNEL;
  const closestMatch = Object.entries(CEMENT_PEAKS_E).reduce<{
    element: string;
    delta: number;
  } | null>((best, [element, energy]) => {
    const delta = Math.abs(energy - peakEnergy);
    if (!best || delta < best.delta) {
      return { element, delta };
    }

    return best;
  }, null);

  return closestMatch && closestMatch.delta <= ELEMENT_MATCH_TOLERANCE_KEV
    ? closestMatch.element
    : null;
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
          horizontalSpacing="xs"
          verticalSpacing="sm"
          withTableBorder={false}
          withColumnBorders={false}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Элемент</Table.Th>
              <Table.Th>Каналы</Table.Th>
              <Table.Th>Инф.</Table.Th>
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
                  const roiLabel = resolveRoiLabel(roi) ?? `ROI ${roiNumber}`;

                  return (
                    <Table.Tr
                      key={roi.id}
                      bg={selected ? "var(--mantine-color-blue-0)" : undefined}
                      onMouseEnter={() => onSelect(roi.id)}
                      onMouseLeave={() => onSelect(null)}
                    >
                      <Table.Td>{roiNumber}</Table.Td>
                      <Table.Td>
                        <Text fw={500}>{roiLabel}</Text>
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
