import { useMemo } from "react";
import { renderMarkdown } from "../lib/markdown";
import { cx } from "./ui";

export function Markdown({ source, className, empty }: { source: string; className?: string; empty?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  if (!html) return empty ? <p className="text-sm italic text-muted">{empty}</p> : null;
  return <div className={cx("md-content", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
