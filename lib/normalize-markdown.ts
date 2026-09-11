export function normalizeCopiedMarkdown(input: string): string {
  let text = input.trim().replace(/\r\n/g, "\n");

  if (!text.includes("\n") && text.includes("\\n")) {
    text = text.replace(/\\n/g, "\n");
  }

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // Some Markdown exporters escape math delimiters a second time. Remove only
  // the extra delimiter slash so `\\` row separators inside matrices survive.
  text = text
    .replaceAll("\\\\(", "\\(")
    .replaceAll("\\\\)", "\\)")
    .replaceAll("\\\\[", "\\[")
    .replaceAll("\\\\]", "\\]");

  text = text.replace(/^\s{2,}([*-]\s+)/gm, "$1");
  text = text.replace(/\\\$([^$\n]+)\$/g, (_match, expr: string) => `$${expr.trim()}$`);
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => `\n$$\n${expr.trim()}\n$$\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => `$${expr.trim()}$`);

  text = wrapBareLatex(text);

  return text;
}

function wrapBareLatex(input: string): string {
  const lines = input.split("\n");
  const output: string[] = [];
  let inFence = false;
  let inDisplayMath = false;
  let latexEnvironment: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    if (trimmed === "$$") {
      inDisplayMath = !inDisplayMath;
      output.push(line);
      continue;
    }

    if (inDisplayMath) {
      output.push(line);
      continue;
    }

    if (latexEnvironment) {
      latexEnvironment.push(line);
      if (/^\\end\{[^}]+\}\s*$/.test(trimmed)) {
        output.push("$$", ...latexEnvironment, "$$");
        latexEnvironment = null;
      }
      continue;
    }

    if (/^\\begin\{[^}]+\}/.test(trimmed) && !trimmed.endsWith("\\end{")) {
      latexEnvironment = [line];
      if (/\\end\{[^}]+\}\s*$/.test(trimmed)) {
        output.push("$$", ...latexEnvironment, "$$");
        latexEnvironment = null;
      }
      continue;
    }

    if (isBareLatexLine(trimmed)) {
      output.push("$$", line, "$$");
    } else {
      output.push(line);
    }
  }

  if (latexEnvironment) {
    output.push("$$", ...latexEnvironment, "$$");
  }

  return output.join("\n");
}

function isBareLatexLine(line: string): boolean {
  if (!line || line.startsWith("$$") || line.startsWith("\\[") || line.startsWith("\\(")) {
    return false;
  }

  if (/\$[^$]+\$/.test(line) || /\\[()\[\]]/.test(line)) {
    return false;
  }

  // Markdown structure and prose containing a command should remain Markdown.
  if (/^(?:[#>*-]|\d+[.)]|\|)/.test(line) || /^https?:\/\//.test(line)) {
    return false;
  }

  return /\\[a-zA-Z]+\b/.test(line);
}
