export type TokenKind = "comment" | "string" | "number" | "keyword" | "call" | "type";

export interface Token {
  kind?: TokenKind;
  text: string;
}

type Rule = [TokenKind, RegExp];

const words = (list: string) => new RegExp(`\\b(?:${list.replaceAll(" ", "|")})\\b`);

function language(rules: Rule[], flags = "gm") {
  return {
    kinds: rules.map(([kind]) => kind),
    pattern: new RegExp(rules.map(([, rule]) => `(${rule.source})`).join("|"), flags),
  };
}

const SCRIPT = language([
  ["comment", /\/\/.*|\/\*[\s\S]*?\*\//],
  ["string", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`/],
  ["number", /\b\d[\d_.]*\b/],
  [
    "keyword",
    words(
      "import from export default async await function return const let var if else for while new throw try catch class extends type interface as of in typeof true false null undefined this",
    ),
  ],
  ["call", /\b[A-Za-z_$][\w$]*(?=\()/],
  ["type", /\b[A-Z][\w$]*\b|(?<=<\/?)[a-z][\w-]*(?=[\s/>])/],
]);

const SQL = language(
  [
    ["comment", /--.*/],
    ["string", /'(?:[^'\n]|'')*'/],
    ["number", /\b\d+\b/],
    [
      "keyword",
      words(
        "create table primary key not null references default unique index on alter add drop insert into values select from where and or",
      ),
    ],
    ["type", words("uuid text int integer bigint boolean jsonb timestamptz")],
  ],
  "gim",
);

const JSON_TEXT = language([
  ["keyword", /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
  ["string", /"(?:[^"\\\n]|\\.)*"/],
  ["number", /-?\b\d+(?:\.\d+)?\b/],
  ["keyword", words("true false null")],
]);

const MARKDOWN = language([
  ["keyword", /^#{1,6} .*$/],
  ["string", /^```[\s\S]*?^```$|^ {4}.*$|`[^`\n]+`/],
  ["number", /^\s*(?:[-*]|\d+\.)(?= )/],
  ["call", /\[[^\]\n]+\]\([^)\n]+\)/],
]);

const LANGUAGES: Record<string, ReturnType<typeof language>> = {
  ts: SCRIPT,
  tsx: SCRIPT,
  js: SCRIPT,
  sql: SQL,
  json: JSON_TEXT,
  md: MARKDOWN,
};

/* Splits a file into tokens that add back up to its exact text, so they can sit under an editor. */
export function highlight(path: string, text: string): Token[] {
  const found = LANGUAGES[path.split(".").pop() ?? ""];
  if (!found) return [{ text }];

  const tokens: Token[] = [];
  let end = 0;
  for (const match of text.matchAll(found.pattern)) {
    if (match.index > end) tokens.push({ text: text.slice(end, match.index) });
    const rule = match.findIndex((group, index) => index > 0 && group !== undefined) - 1;
    tokens.push({ kind: found.kinds[rule], text: match[0] });
    end = match.index + match[0].length;
  }
  if (end < text.length) tokens.push({ text: text.slice(end) });
  return tokens;
}
