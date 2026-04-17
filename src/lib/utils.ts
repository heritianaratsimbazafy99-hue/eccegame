import type { CardTruth, DecisionOptionId } from "../types";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function slugify(value: string): string {
  const base = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "groupe";
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

export function createRng(seed: string): () => number {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(31, state) + seed.charCodeAt(index);
  }
  let current = state >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = Math.imul(current ^ (current >>> 15), current | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

export function getTruthDistribution(size: number): Record<CardTruth, number> {
  if (size <= 1) {
    return { true: 1, partial: 0, false: 0 };
  }

  if (size === 2) {
    return { true: 1, partial: 1, false: 0 };
  }

  let falseCount = size >= 4 ? Math.max(1, Math.round(size * 0.18)) : 1;
  let partialCount = Math.max(1, Math.round(size * 0.25));
  let trueCount = size - partialCount - falseCount;

  const requiredMajority = Math.ceil(size * 0.5);
  while (trueCount < requiredMajority && partialCount > 1) {
    partialCount -= 1;
    trueCount += 1;
  }

  while (trueCount < requiredMajority && falseCount > 1) {
    falseCount -= 1;
    trueCount += 1;
  }

  return { true: trueCount, partial: partialCount, false: falseCount };
}

export function buildCardUrl(baseUrl: string, cardId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/?card=${encodeURIComponent(cardId)}`;
}

export function buildFacilitatorUrl(baseUrl: string, teamId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/?facilitator=${encodeURIComponent(teamId)}`;
}

export function buildRestitutionUrl(baseUrl: string, teamId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/?restitution=${encodeURIComponent(teamId)}`;
}

export function buildQrSheetUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/?sheet=qrs`;
}

export function buildLiveBoardUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/?board=live`;
}

export function labelTruth(value: CardTruth): string {
  if (value === "true") {
    return "Vraie";
  }
  if (value === "partial") {
    return "Partielle";
  }
  return "Faussée";
}

export function labelDecision(value: DecisionOptionId): string {
  return value === "A" ? "Décision A" : "Décision B";
}

export function clampText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}
