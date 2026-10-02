// The large document for G-105, built at run time so no multi-megabyte file
// is checked in. Only tests and the dev tools import this; it must stay free
// of CodeMirror so it never reaches the production bundle.

export const DEFAULT_LARGE_DOCUMENT_SEED = 105;

const LINE_COUNT = 50_000;
// About 100 characters per line, as in the research document.
const TARGET_LENGTH = 5_000_000;

const WORDS = [
  "note",
  "editor",
  "markdown",
  "plain",
  "text",
  "draft",
  "idea",
  "quiet",
  "window",
  "paper",
  "line",
  "block",
  "heading",
  "focus",
  "write",
  "read",
  "keep",
  "simple",
  "local",
  "file",
  "folder",
  "change",
  "morning",
  "evening",
  "project",
  "meeting",
  "summary",
  "detail",
  "question",
  "answer",
  "list",
  "table",
  "quote",
  "code",
  "link",
  "page",
  "week",
  "small",
  "large",
  "fast",
  "slow",
  "careful",
  "clear",
  "open",
  "close",
  "save",
  "after",
  "before",
  "under",
  "over",
  "with",
  "without",
  "about",
  "the",
  "a",
  "and",
  "of",
  "to",
  "in",
  "is",
  "it",
  "that",
];

const CODE_LANGUAGES = ["ts", "rust", "sh", "json", ""];

type Random = () => number;

// mulberry32: small, fast and good enough for fixture text.
function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function word(random: Random): string {
  return WORDS[Math.floor(random() * WORDS.length)];
}

function words(random: Random, count: number): string {
  const result: string[] = [];
  for (let i = 0; i < count; i++) result.push(word(random));
  return result.join(" ");
}

function inline(random: Random): string {
  const roll = random();
  if (roll < 0.04) return `*${words(random, between(random, 1, 3))}*`;
  if (roll < 0.08) return `**${words(random, between(random, 1, 3))}**`;
  if (roll < 0.1) return `~~${words(random, between(random, 1, 2))}~~`;
  if (roll < 0.13) return `\`${word(random)}()\``;
  if (roll < 0.15) {
    return `[${words(random, 2)}](https://example.com/${word(random)})`;
  }
  return word(random);
}

function sentence(random: Random): string {
  const parts: string[] = [];
  const count = between(random, 6, 18);
  for (let i = 0; i < count; i++) parts.push(inline(random));
  const text = parts.join(" ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function paragraph(random: Random, length: number): string {
  const sentences: string[] = [];
  let total = 0;
  while (total < length) {
    const next = sentence(random);
    sentences.push(next);
    total += next.length + 1;
  }
  return sentences.join(" ");
}

function codeLine(random: Random): string {
  const name = word(random);
  const other = word(random);
  const count = between(random, 0, 999);
  switch (between(random, 0, 3)) {
    case 0:
      return `const ${name} = load("${other}");`;
    case 1:
      return `  if (${name}.length > ${count}) return ${other};`;
    case 2:
      return `  ${name}.push(${other}, ${count});`;
    default:
      return `// ${words(random, between(random, 3, 8))}`;
  }
}

export function generateLargeDocument(seed: number): string {
  const random = seededRandom(seed);
  const lines: string[] = [];
  // Characters so far, counting the line break after every line.
  let length = 0;

  const push = (line: string) => {
    lines.push(line);
    length += line.length + 1;
  };

  // Paragraphs are the only long lines, so their length steers the total
  // towards TARGET_LENGTH whatever the other blocks happened to add.
  const prose = () => {
    const remainingLines = Math.max(1, LINE_COUNT - lines.length);
    const perLine = (TARGET_LENGTH - length) / remainingLines;
    const target = Math.min(2000, Math.max(200, Math.round(perLine * 9)));
    push(paragraph(random, between(random, target - 100, target + 100)));
    push("");
  };

  push("---");
  push(`title: Large document ${seed}`);
  push("tags: [quiro, fixture, large]");
  push(`seed: ${seed}`);
  push("---");
  push("");
  push(`# Large document ${seed}`);
  push("");

  let section = 0;
  while (lines.length < LINE_COUNT) {
    section++;
    const level = between(random, 2, 4);
    const title = words(random, between(random, 2, 5));
    push(`${"#".repeat(level)} ${section}. ${title}`);
    push("");
    prose();
    prose();

    for (let i = between(random, 2, 5); i > 0; i--) {
      push(`- ${sentence(random)}`);
    }
    push("");

    for (let i = 1, n = between(random, 2, 4); i <= n; i++) {
      push(`${i}. ${sentence(random)}`);
    }
    push("");

    for (let i = between(random, 2, 4); i > 0; i--) {
      const done = random() < 0.5 ? "x" : " ";
      push(`- [${done}] ${words(random, between(random, 3, 7))}`);
    }
    push("");

    for (let i = between(random, 1, 3); i > 0; i--) {
      push(`> ${sentence(random)}`);
    }
    push("");

    const language =
      CODE_LANGUAGES[between(random, 0, CODE_LANGUAGES.length - 1)];
    push(`\`\`\`${language}`);
    for (let i = between(random, 3, 8); i > 0; i--) push(codeLine(random));
    push("```");
    push("");

    push("| Name | State | Count |");
    push("| :--- | :---: | ---: |");
    for (let i = between(random, 2, 5); i > 0; i--) {
      const count = between(random, 0, 9999);
      push(`| ${word(random)} | ${word(random)} | ${count} |`);
    }
    push("");

    prose();
  }

  return lines.slice(0, LINE_COUNT).join("\n");
}
