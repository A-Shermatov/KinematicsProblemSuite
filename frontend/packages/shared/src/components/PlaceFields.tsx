import { useEffect, useId, useState } from "react";
import { api } from "../api";
import { Input } from "./ui";

/** Города Таджикистана для подсказок; к ним добавляются города, которые уже ввели пользователи. */
const KNOWN_CITIES = [
  "Худжанд", "Душанбе", "Бохтар", "Куляб", "Истаравшан", "Исфара", "Канибадам", "Пенджикент", "Бустон",
  "Гулистон", "Турсунзаде", "Гиссар", "Вахдат", "Хорог", "Нурек", "Рогун", "Яван", "Гафуров", "Спитамен",
];

interface Props {
  city: string;
  school: string;
  onChange: (value: { city: string; school: string }) => void;
}

/** Необязательные поля «Город» и «Школа» с подсказками — для рейтингов школ и городов. */
export function PlaceFields({ city, school, onChange }: Props) {
  const cityList = useId();
  const schoolList = useId();
  const [cities, setCities] = useState<string[]>(KNOWN_CITIES);
  const [schools, setSchools] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.stats
        .places(city.trim() || undefined)
        .then((places) => {
          const known = new Set(KNOWN_CITIES.map((c) => c.toLowerCase()));
          setCities([...KNOWN_CITIES, ...places.cities.filter((c) => !known.has(c.toLowerCase()))]);
          setSchools(places.schools);
        })
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [city]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Input
          label="Город"
          list={cityList}
          value={city}
          onChange={(e) => onChange({ city: e.target.value, school })}
          maxLength={60}
          placeholder="Необязательно"
          autoComplete="address-level2"
        />
        <datalist id={cityList}>
          {cities.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
      <div>
        <Input
          label="Школа / лицей"
          list={schoolList}
          value={school}
          onChange={(e) => onChange({ city, school: e.target.value })}
          maxLength={120}
          placeholder="Необязательно"
          hint="Для рейтинга школ"
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
