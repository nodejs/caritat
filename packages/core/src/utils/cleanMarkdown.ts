function cleanUnsupportedMarkdown(txt: string): string {
  // escape _~*\[]<>`
  return txt.replace(/([_~*\\[\]<>`])/g, "\\$1");
}

function reduceToFirstLine(candidate: string) {
  const i = candidate.indexOf("\n");
  return i === -1 ? candidate : candidate.slice(0, i);
}
export default function cleanMarkdown(txt: string, keepOnlyFirstLineInSummary?: boolean): string {
  if (keepOnlyFirstLineInSummary) txt = reduceToFirstLine(txt);
  if (txt.endsWith(".") || txt.endsWith(":")) txt = txt.slice(0, -1);

  // Escape backticks for edge case scenarii (no code span support).
  if (txt.includes("``") || txt.includes("\\`")) {
    return cleanUnsupportedMarkdown(txt);
  }

  const backtickSplit = txt.split("`");
  // If there's an odd number of backticks, give up and escape them all.
  if (backtickSplit.length % 2 === 0) return cleanUnsupportedMarkdown(txt);

  let cleanMdString = "";
  for (let i = 0; i < backtickSplit.length; i++) {
    const isInsideBacktickString = i % 2;
    cleanMdString += isInsideBacktickString
      // No escaping inside a code span.
      ? `\`${backtickSplit[i]}\``
      // otherwise escape _~*\[]<>
      : backtickSplit[i].replace(/([_~*\\[\]<>])/g, "\\$1");
  }
  return cleanMdString;
}
