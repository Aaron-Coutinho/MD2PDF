export function normalizeCopiedMarkdown(input: string): string {
  let text = input.trim().replace(/\r\n/g, "\n");

  if (!text.includes("\n") && text.includes("\\n")) {
    text = text.replace(/\\n/g, "\n");
  }

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/^\s{2,}([*-]\s+)/gm, "$1");
  text = text.replace(/\\\$([^$\n]+)\$/g, (_match, expr: string) => `$${expr.trim()}$`);
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => `\n$$\n${expr.trim()}\n$$\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => `$${expr.trim()}$`);

  return text;
}
