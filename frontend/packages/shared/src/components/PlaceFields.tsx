import { useEffect, useId, useState } from "react";
import { api, type Region } from "../api";
import { t } from "../i18n";
import { countryOptions, flagEmoji } from "../lib/geo";
import { useAsync } from "../lib/hooks";
import { Input, Select } from "./ui";

export interface Place {
  country_code: string;
  region_id: number | null;
  city: string;
  school: string;
}

interface Props {
  value: Place;
  onChange: (value: Place) => void;
  /** Поле страны: по умолчанию скрыто (Таджикистан), админ включает его в настройках. */
  showCountry: boolean;
}

const OTHER = "__other__";

/** Страна → область → город (списки зависят от выбора выше) и школа. Всё, кроме страны, необязательно. */
export function PlaceFields({ value, onChange, showCountry }: Props) {
  const schoolList = useId();
  const [schools, setSchools] = useState<string[]>([]);
  const { data: regions } = useAsync(() => api.geo.regions(value.country_code).catch(() => [] as Region[]), [value.country_code]);
  const region = regions?.find((r) => r.id === value.region_id) ?? null;
  const cities = region?.cities ?? [];
  const cityInList = cities.some((c) => c.name.toLowerCase() === value.city.trim().toLowerCase());
  const [typing, setTyping] = useState(false);
  const manualCity = !region || cities.length === 0 || typing || (!!value.city && !cityInList);
  const set = (patch: Partial<Place>) => onChange({ ...value, ...patch });

  useEffect(() => {
    const timer = setTimeout(() => {
      api.stats
        .places(value.city.trim() || undefined)
        .then((places) => setSchools(places.schools))
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [value.city]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showCountry && (
        <Select
          label={t("Страна")}
          value={value.country_code}
          onChange={(e) => {
            setTyping(false);
            onChange({ ...value, country_code: e.target.value, region_id: null, city: "" });
          }}
          autoComplete="country"
        >
          {countryOptions().map((country) => (
            <option key={country.code} value={country.code}>
              {flagEmoji(country.code)} {country.name}
            </option>
          ))}
        </Select>
      )}
      {regions && regions.length > 0 && (
        <Select
          label={t("Область")}
          value={value.region_id ?? ""}
          onChange={(e) => {
            setTyping(false);
            set({ region_id: e.target.value ? Number(e.target.value) : null, city: "" });
          }}
        >
          <option value="">{t("Не выбрана")}</option>
          {regions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      )}
      {manualCity ? (
        <Input
          label={t("Город / район")}
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
          maxLength={60}
          placeholder={region ? t("Впишите свой город") : t("Необязательно")}
          autoComplete="address-level2"
          hint={region && cities.length > 0 ? (
            <button type="button" className="text-primary hover:underline" onClick={() => { setTyping(false); set({ city: "" }); }}>
              {t("Выбрать из списка")}
            </button>
          ) : undefined}
        />
      ) : (
        <Select
          label={t("Город / район")}
          value={cityInList ? cities.find((c) => c.name.toLowerCase() === value.city.trim().toLowerCase())!.name : ""}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setTyping(true);
              set({ city: "" });
            } else set({ city: e.target.value });
          }}
        >
          <option value="">{t("Не выбран")}</option>
          {cities.map((city) => (
            <option key={city.id} value={city.name}>
              {city.name}
            </option>
          ))}
          <option value={OTHER}>{t("Другой — вписать…")}</option>
        </Select>
      )}
      <div className={showCountry || (regions && regions.length > 0) ? "" : "sm:col-span-1"}>
        <Input
          label={t("Школа / лицей")}
          list={schoolList}
          value={value.school}
          onChange={(e) => set({ school: e.target.value })}
          maxLength={120}
          placeholder={t("Необязательно")}
          hint={t("Для рейтинга школ")}
        />
        <datalist id={schoolList}>
          {schools.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

/** Значение для формы из профиля пользователя. */
export function placeOf(user: { country_code?: string; region_id?: number | null; city: string | null; school: string | null } | null): Place {
  return { country_code: user?.country_code ?? "TJ", region_id: user?.region_id ?? null, city: user?.city ?? "", school: user?.school ?? "" };
}

/** Для запроса: пустые строки → null. */
export function placePayload(place: Place) {
  return { country_code: place.country_code, region_id: place.region_id, city: place.city.trim() || null, school: place.school.trim() || null };
}
