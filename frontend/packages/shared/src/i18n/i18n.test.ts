import { afterEach, describe, expect, it } from "vitest";
import { plural } from "../lib/format";
import en from "./en";
import tg from "./tg";
import { setLangForTests, t } from ".";

afterEach(() => setLangForTests("ru"));

describe("i18n", () => {
  it("по умолчанию — русский, подстановки работают", () => {
    expect(t("Задачи")).toBe("Задачи");
    expect(t("Ошибка {0}", [500])).toBe("Ошибка 500");
  });

  it("переводит и откатывается на русский, если перевода нет", () => {
    setLangForTests("en");
    expect(t("Задачи")).toBe("Tasks");
    expect(t("Ошибка {0}", [500])).toBe("Error 500");
    expect(t("Строка без перевода")).toBe("Строка без перевода");
  });

  it("формы слов после числа", () => {
    const forms: [string, string, string] = ["задача", "задачи", "задач"];
    expect(plural(5, forms)).toBe("задач");
    setLangForTests("en");
    expect([plural(1, forms), plural(5, forms)]).toEqual(["task", "tasks"]);
    setLangForTests("tg");
    expect(plural(5, forms)).toBe("масъала");
  });

  it("в словарях одинаковый набор ключей и сохранены подстановки", () => {
    expect(Object.keys(tg).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(en)) {
      if (typeof value !== "string") continue;
      const placeholders = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join();
      expect(placeholders(value), key).toBe(placeholders(key));
      expect(placeholders(tg[key] as string), key).toBe(placeholders(key));
    }
  });
});
