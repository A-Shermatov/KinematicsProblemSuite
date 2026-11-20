import { useState } from "react";
import type { AiModel } from "../api";
import { t } from "../i18n";

const STORAGE_KEY = "kps.aiModel";

function load(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

/** Выбранная модель распознавания; запоминается в браузере. */
export function useAiModel(models: AiModel[] | undefined): [string, (value: string) => void] {
  const [value, setValue] = useState(load);
  const valid = value === "auto" || (models ?? []).some((model) => model.id === value) ? value : "auto";
  const update = (next: string) => {
    setValue(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* приватный режим */
    }
  };
  return [valid, update];
}

export function aiModelLabel(models: AiModel[] | undefined, id: string | null | undefined): string | null {
  if (!id) return null;
  return (models ?? []).find((model) => model.id === id)?.label ?? id;
}

/** Выбор бесплатной модели Gemini для распознавания фото и PDF. */
export function AiModelSelect({ models, value, onChange, className }: { models: AiModel[]; value: string; onChange: (value: string) => void; className?: string }) {
  const current = models.find((model) => model.id === value);
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-muted">{t("Модель распознавания (бесплатная)")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg"
        title={current?.hint}
      >
        <option value="auto">{t("Авто — лучшая доступная")}</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
            {model.hint ? ` — ${model.hint}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
