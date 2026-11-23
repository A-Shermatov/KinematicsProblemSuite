import { useRef, useState } from "react";
import { LatexHelpButton, LatexReference, insertLatexAt } from "./LatexReference";
import { Input, Textarea } from "./ui";

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** Однострочное поле (пояснение к ошибке и т. п.). */
  single?: boolean;
  ariaLabel?: string;
}

/** Обычное поле, где можно писать формулы, — с кнопкой справочника LaTeX (и Ctrl+/). */
export function LatexField({ label, value, onChange, placeholder, maxLength, rows = 2, single, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = single ? inputRef : textRef;
  const keys = (event: { ctrlKey: boolean; metaKey: boolean; key: string; preventDefault: () => void }) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "/") {
      event.preventDefault();
      setOpen((v) => !v);
    }
  };
  return (
    <div className="space-y-1">
      <div className="relative">
        {single ? (
          <Input ref={inputRef} label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-label={ariaLabel} onKeyDown={keys} className="pr-14" />
        ) : (
          <Textarea ref={textRef} label={label} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-label={ariaLabel} onKeyDown={keys} />
        )}
        <div className={single ? "absolute bottom-1.5 right-1.5" : "absolute right-1.5 top-0"}>
          <LatexHelpButton open={open} onToggle={() => setOpen((v) => !v)} className={single ? "px-1.5 text-xs [&]:h-8" : "h-6 text-xs"} />
        </div>
      </div>
      {open && (
        <div className="overflow-hidden rounded-xl border border-border">
          <LatexReference onInsert={(code) => insertLatexAt(ref, value, onChange, code)} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
