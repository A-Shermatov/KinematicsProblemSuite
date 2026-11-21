import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Markdown } from "./Markdown";
import { cx } from "./ui";
import { t } from "../i18n";

interface Item {
  /** Что вставить; «□» — место курсора. */
  code: string;
  /** Подпись (поиск идёт и по ней). */
  label: string;
}

interface Group {
  title: string;
  items: Item[];
}

/** Справочник LaTeX: самое нужное для задач по физике и математике. */
export const LATEX_GROUPS: Group[] = [
  {
    title: "Основное",
    items: [
      { code: "\\frac{a}{b}", label: "дробь" },
      { code: "x^{2}", label: "степень" },
      { code: "v_{0}", label: "индекс" },
      { code: "\\sqrt{x}", label: "корень" },
      { code: "\\sqrt[3]{x}", label: "корень n-й степени" },
      { code: "\\left( \\frac{a}{b} \\right)", label: "скобки по высоте" },
      { code: "|x|", label: "модуль" },
      { code: "\\cdot", label: "умножение точкой" },
      { code: "\\times", label: "умножение крестом" },
      { code: "\\pm", label: "плюс-минус" },
      { code: "10^{-3}", label: "отрицательная степень" },
      { code: "2{,}5 \\cdot 10^{3}", label: "запятая и порядок" },
    ],
  },
  {
    title: "Сравнения",
    items: [
      { code: "\\approx", label: "приблизительно" },
      { code: "\\neq", label: "не равно" },
      { code: "\\leq", label: "меньше или равно" },
      { code: "\\geq", label: "больше или равно" },
      { code: "\\ll", label: "много меньше" },
      { code: "\\gg", label: "много больше" },
      { code: "\\sim", label: "порядка" },
      { code: "\\propto", label: "пропорционально" },
      { code: "\\Rightarrow", label: "следует" },
      { code: "\\to", label: "стремится" },
    ],
  },
  {
    title: "Греческие буквы",
    items: [
      ...["alpha", "beta", "gamma", "delta", "varepsilon", "eta", "theta", "lambda", "mu", "nu", "pi", "rho", "sigma", "tau", "varphi", "omega"].map((name) => ({
        code: `\\${name}`,
        label: name,
      })),
      ...["Delta", "Phi", "Omega", "Sigma"].map((name) => ({ code: `\\${name}`, label: name })),
    ],
  },
  {
    title: "Векторы и производные",
    items: [
      { code: "\\vec{v}", label: "вектор" },
      { code: "\\overrightarrow{AB}", label: "вектор AB" },
      { code: "\\dot{x}", label: "производная по времени" },
      { code: "\\ddot{x}", label: "вторая производная" },
      { code: "\\frac{dx}{dt}", label: "производная" },
      { code: "\\frac{\\partial f}{\\partial x}", label: "частная производная" },
      { code: "\\Delta t", label: "изменение (дельта)" },
      { code: "\\bar{v}", label: "среднее" },
      { code: "\\hat{x}", label: "единичный вектор" },
    ],
  },
  {
    title: "Суммы и интегралы",
    items: [
      { code: "\\sum_{i=1}^{n} x_i", label: "сумма" },
      { code: "\\int_{a}^{b} f(x)\\,dx", label: "интеграл" },
      { code: "\\lim_{x \\to 0} f(x)", label: "предел" },
      { code: "\\infty", label: "бесконечность" },
      { code: "\\sin\\alpha", label: "синус" },
      { code: "\\cos\\alpha", label: "косинус" },
      { code: "\\tan\\alpha", label: "тангенс" },
      { code: "\\log_{2} x", label: "логарифм" },
      { code: "\\ln x", label: "натуральный логарифм" },
    ],
  },
  {
    title: "Физика и единицы",
    items: [
      { code: "v = 20\\ \\text{м/с}", label: "единицы текстом" },
      { code: "a = 9{,}8\\ \\text{м/с}^2", label: "ускорение" },
      { code: "30^\\circ", label: "градусы" },
      { code: "t = 25\\,^\\circ\\text{C}", label: "температура" },
      { code: "F = m a", label: "закон Ньютона" },
      { code: "E_k = \\frac{m v^2}{2}", label: "кинетическая энергия" },
      { code: "h = \\frac{v_0^2}{2g}", label: "высота подъёма" },
      { code: "\\text{кг} \\cdot \\text{м}^2", label: "составная единица" },
    ],
  },
  {
    title: "Системы и матрицы",
    items: [
      { code: "\\begin{cases} x + y = 5 \\\\ x - y = 1 \\end{cases}", label: "система уравнений" },
      { code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", label: "матрица" },
      { code: "\\begin{aligned} a &= b + c \\\\ &= d \\end{aligned}", label: "выравнивание по =" },
      { code: "\\underbrace{a + b}_{\\text{сумма}}", label: "подпись снизу" },
      { code: "\\boxed{x = 5}", label: "ответ в рамке" },
    ],
  },
];

/** Внутри формулы ли курсор: нечётное число «$» до него в текущем абзаце. */
export function insideMath(text: string, cursor: number): boolean {
  const paragraph = text.slice(text.lastIndexOf("\n\n", cursor - 1) + 1, cursor);
  const dollars = paragraph.replace(/\\\$/g, "").match(/\$/g)?.length ?? 0;
  return dollars % 2 === 1;
}

/** Текст для вставки: вне формулы оборачиваем в $…$. */
export function latexInsertion(text: string, cursor: number, code: string): string {
  return insideMath(text, cursor) ? code : `$${code}$`;
}

interface Props {
  onInsert: (code: string) => void;
  onClose: () => void;
}

/** Панель справочника: поиск, группы, предпросмотр каждой формулы. Клик — вставить. */
export function LatexReference({ onInsert, onClose }: Props) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => searchRef.current?.focus(), []);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LATEX_GROUPS;
    return LATEX_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.code.toLowerCase().includes(q) || t(item.label).toLowerCase().includes(q) || item.label.includes(q)),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <div
      className="max-h-[22rem] overflow-y-auto border-b border-border bg-surface p-3"
      role="dialog"
      aria-label={t("Справочник формул LaTeX")}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Найти: дробь, sqrt, вектор, alpha…")}
          aria-label={t("Поиск по справочнику")}
          className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-primary focus:outline-none"
        />
        <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg" aria-label={t("Закрыть справочник")}>
          ✕
        </button>
      </div>
      {groups.length === 0 && <p className="py-4 text-center text-sm text-muted">{t("Ничего не нашлось")}</p>}
      {groups.map((group) => (
        <div key={group.title} className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t(group.title)}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {group.items.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => onInsert(item.code)}
                title={`${t(item.label)}: ${item.code}`}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-center hover:border-primary hover:bg-primary-soft/40"
              >
                <span className="pointer-events-none max-w-full overflow-hidden text-sm text-fg">
                  <Markdown source={`$${item.code}$`} />
                </span>
                <code className="max-w-full truncate text-[10px] text-muted">{item.code}</code>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted">
        {t("Вне формулы вставка оборачивается в $…$. Полный список команд —")}{" "}
        <a href="https://katex.org/docs/supported.html" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          KaTeX
        </a>
        .
      </p>
    </div>
  );
}

/** Вставить код справочника в поле (textarea или input) в позицию курсора. */
export function insertLatexAt(
  ref: RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  value: string,
  onChange: (value: string) => void,
  code: string,
) {
  const field = ref.current;
  const start = field?.selectionStart ?? value.length;
  const end = field?.selectionEnd ?? value.length;
  const text = latexInsertion(value, start, code);
  onChange(value.slice(0, start) + text + value.slice(end));
  requestAnimationFrame(() => {
    if (!field) return;
    field.focus();
    const cursor = start + text.length;
    field.setSelectionRange(cursor, cursor);
  });
}

/** Кнопка «ƒx» рядом с обычным полем (подсказки, пояснения к ошибкам) — открывает справочник. */
export function LatexHelpButton({ className, open, onToggle }: { className?: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={t("Справочник формул LaTeX (Ctrl+/)")}
      className={cx("h-8 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg", open && "bg-primary-soft text-primary", className)}
    >
      ƒx {t("Справочник")}
    </button>
  );
}
