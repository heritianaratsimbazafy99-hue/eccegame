import * as XLSX from "xlsx";
import type { Participant, WorkbookParseResult } from "../types";
import { hashString, normalizeText, slugify } from "./utils";

type ColumnMap = {
  matricule: number;
  name: number;
  direction: number;
  service: number;
  tana: number;
  province: number;
  note: number;
};

function asText(value: unknown): string {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function findColumnIndex(
  labels: string[],
  matchers: Array<(value: string) => boolean>
): number {
  return labels.findIndex((value) => matchers.some((matcher) => matcher(value)));
}

function hasWord(value: string, expected: string): boolean {
  return value.split(/\s+/).includes(expected);
}

function inferColumnMap(rows: unknown[][]): { headerRowIndex: number; columns: ColumnMap } {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeText(asText(cell)).includes("prenom"))
  );

  if (headerRowIndex === -1) {
    throw new Error("Impossible de repérer la ligne d'en-tête dans le fichier Excel.");
  }

  const upperRow = rows[Math.max(0, headerRowIndex - 1)] ?? [];
  const headerRow = rows[headerRowIndex] ?? [];
  const width = Math.max(upperRow.length, headerRow.length);

  const labels = Array.from({ length: width }, (_, index) => {
    const parts = [asText(upperRow[index]), asText(headerRow[index])]
      .filter(Boolean)
      .join(" ");
    return normalizeText(parts);
  });

  const matricule = findColumnIndex(labels, [
    (value) => value.includes("matr"),
    (value) => value.includes("matric")
  ]);
  const name = findColumnIndex(labels, [(value) => value.includes("prenom")]);
  const direction = findColumnIndex(labels, [
    (value) => value === "dir",
    (value) => hasWord(value, "dir"),
    (value) => value.includes("direction")
  ]);
  const service = findColumnIndex(labels, [
    (value) => value.includes("service"),
    (value) => value.includes("equipe"),
    (value) => value.includes("departement"),
    (value) => value.includes("pole"),
    (value) => value.includes("metier")
  ]);
  const tana = findColumnIndex(labels, [
    (value) => value.includes("tana"),
    (value) => value.includes("antananarivo")
  ]);
  const province = findColumnIndex(labels, [(value) => value.includes("province")]);

  let note = findColumnIndex(labels, [
    (value) => value.includes("note"),
    (value) => value.includes("comment"),
    (value) => value.includes("observ")
  ]);

  const fallbackService = service === -1 && direction >= 0 ? direction + 1 : service;
  if (note === -1) {
    note = Math.max(matricule, name, direction, fallbackService, tana, province) + 1;
  }

  if (name === -1 || direction === -1) {
    throw new Error(
      "Le fichier ne contient pas les colonnes minimales attendues (prénom, direction)."
    );
  }

  return {
    headerRowIndex,
    columns: {
      matricule,
      name,
      direction,
      service: fallbackService,
      tana,
      province,
      note
    }
  };
}

function buildParticipant(rawRow: unknown[], columns: ColumnMap, position: number): Participant | null {
  const name = asText(rawRow[columns.name]);
  if (!name) {
    return null;
  }

  const direction = asText(rawRow[columns.direction]) || "Direction non précisée";
  const service = columns.service >= 0 ? asText(rawRow[columns.service]) : "";
  const location =
    asText(rawRow[columns.tana]) === "1"
      ? "Tanà"
      : asText(rawRow[columns.province]) === "1"
        ? "Province"
        : "";
  const teamName = service || direction;
  const id = slugify(`${teamName}-${name}-${position}-${hashString(name + direction)}`);

  return {
    id,
    matricule: columns.matricule >= 0 ? asText(rawRow[columns.matricule]) : "",
    name,
    direction,
    service,
    teamId: slugify(teamName),
    teamName,
    location,
    note: columns.note >= 0 ? asText(rawRow[columns.note]) : ""
  };
}

export function parseWorkbook(buffer: ArrayBuffer, sourceLabel: string): WorkbookParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("Aucune feuille exploitable n'a été trouvée dans le fichier Excel.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false
  });

  const { headerRowIndex, columns } = inferColumnMap(rows);

  const participants = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => buildParticipant(row, columns, index))
    .filter((participant): participant is Participant => participant !== null);

  return {
    participants,
    sourceLabel
  };
}
