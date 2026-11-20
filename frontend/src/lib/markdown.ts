/**
 * Markdown + формулы LaTeX (KaTeX) → безопасный HTML.
 *
 * Формулы: $v = s/t$ — в строке, $$a = \frac{v - v_0}{t}$$ — отдельным блоком.
 * Также поддерживаются \( … \) и \[ … \]. Знак доллара как валюта: «\$5».
 */
import DOMPurify from "dompurify";
import katex from "katex";
import { Marked, type TokenizerAndRendererExtension, type Tokens } from "marked";

interface MathToken extends Tokens.Generic {
  type: "math" | "mathBlock";
  text: string;
  display: boolean;
}

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: "ignore" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const escaped = tex.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<span class="math-error" title="${message.replace(/"/g, "&quot;")}">${escaped}</span>`;
  }
}

const mathBlock: TokenizerAndRendererExtension = {
  name: "mathBlock",
  level: "block",
  start(src: string) {
    const match = src.match(/\$\$|\\\[/);
    return match?.index;
  },
  tokenizer(src: string) {
    const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])[ \t]*(?:\n+|$)/.exec(src);
    if (!match) return undefined;
    return { type: "mathBlock", raw: match[0], text: (match[1] ?? match[2]).trim(), display: true } as MathToken;
  },
  renderer(token) {
    return `<div class="math-block">${renderMath((token as MathToken).text, true)}</div>\n`;
  },
};

const mathInline: TokenizerAndRendererExtension = {
  name: "math",
  level: "inline",
  start(src: string) {
    const match = src.match(/\$|\\\(/);
    return match?.index;
  },
  tokenizer(src: string) {
    const display = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (display) return { type: "math", raw: display[0], text: display[1].trim(), display: true } as MathToken;
    // Внутри $…$ без пробелов у границ — чтобы «$5 и $6» не превращались в формулу.
    const inline = /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src) ?? /^\\\(([\s\S]+?)\\\)/.exec(src);
    if (inline) return { type: "math", raw: inline[0], text: inline[1], display: false } as MathToken;
    return undefined;
  },
  renderer(token) {
    return renderMath((token as MathToken).text, (token as MathToken).display);
  },
};

const marked = new Marked({ gfm: true, breaks: true, async: false });
marked.use({ extensions: [mathBlock, mathInline] });

export function renderMarkdown(source: string): string {
  if (!source.trim()) return "";
  const html = marked.parse(source) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}
