export type CalloutKind = "NOTE" | "WARNING" | "IMPORTANT";

export type CalloutBlock = {
  kind: CalloutKind;
  body: string;
};

const calloutLine = /^>\s*\[!(NOTE|WARNING|IMPORTANT)\]\s*$/i;

/** Split Markdown into normal segments and GitHub-style callout blockquotes. */
export function splitCallouts(markdown: string): Array<{ type: "md"; text: string } | { type: "callout"; callout: CalloutBlock }> {
  const lines = markdown.split("\n");
  const out: Array<{ type: "md"; text: string } | { type: "callout"; callout: CalloutBlock }> = [];
  let buffer: string[] = [];
  let i = 0;

  const flush = () => {
    if (buffer.length) {
      out.push({ type: "md", text: buffer.join("\n") });
      buffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const match = calloutLine.exec(line.trim());
    if (match) {
      flush();
      const kind = match[1].toUpperCase() as CalloutKind;
      i += 1;
      const bodyLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        bodyLines.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      out.push({ type: "callout", callout: { kind, body: bodyLines.join("\n").trim() } });
      continue;
    }
    buffer.push(line);
    i += 1;
  }
  flush();
  return out;
}

export function calloutLabel(kind: CalloutKind): string {
  switch (kind) {
    case "NOTE":
      return "Note";
    case "WARNING":
      return "Warning";
    case "IMPORTANT":
      return "Important";
  }
}
