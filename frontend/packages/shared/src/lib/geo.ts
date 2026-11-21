import { getLang } from "../i18n";

/** Коды стран ISO 3166-1 alpha-2 (совпадают с бэкендом, app/modules/geo/countries.py). */
export const COUNTRY_CODES: string[] = ["AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"];

/** Соседи и частые страны — наверху списка. */
const TOP = ["TJ", "UZ", "KG", "KZ", "RU", "AF", "TM", "TR", "CN"];

let names: Intl.DisplayNames | null = null;
let namesLang = "";

/** Название страны на языке интерфейса (для таджикского — по-русски, если браузер не знает tg). */
export function countryName(code: string): string {
  const lang = getLang();
  if (!names || namesLang !== lang) {
    try {
      names = new Intl.DisplayNames([lang, "ru"], { type: "region" });
    } catch {
      names = null;
    }
    namesLang = lang;
  }
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** 🇹🇯 из «TJ»: флаг — пара региональных символов. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function countryOptions(): { code: string; name: string }[] {
  const rest = COUNTRY_CODES.filter((code) => !TOP.includes(code))
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, getLang()));
  return [...TOP.map((code) => ({ code, name: countryName(code) })), ...rest];
}
