/**
 * Finds the text key of every warning the core can make (ADR-265, D18-F6): each `t()`/`tx()` call whose first argument
 * is a string literal (or a choice between literals) and that sits in a warning, either an object with
 * `severity: 'warning'` or an argument of `warn(…)`, `info(…)`, `note(…)` or `warning(…)`. Texts chosen at run time
 * (not literals) are listed by `dynamic` and covered by hand in `WARNING_EXTRA`.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const WARN_FN = new Set(['warn', 'info', 'note', 'warning']);

export interface WarningSite {
  file: string;
  line: number;
  /** The literal keys; null when the key is chosen at run time. */
  keys: string[] | null;
}

function literals(e: ts.Expression | undefined): string[] | null {
  if (!e) return null;
  if (ts.isStringLiteralLike(e)) return [e.text];
  if (ts.isConditionalExpression(e)) {
    const a = literals(e.whenTrue);
    const b = literals(e.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

function isWarningContext(start: ts.Node): boolean {
  let p: ts.Node | undefined = start.parent;
  while (p && !ts.isSourceFile(p) && !ts.isFunctionLike(p)) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && WARN_FN.has(p.expression.text))
      return true;
    if (
      ts.isObjectLiteralExpression(p) &&
      p.properties.some(
        (q) =>
          ts.isPropertyAssignment(q) &&
          q.name.getText() === 'severity' &&
          q.initializer.getText() === "'warning'",
      )
    )
      return true;
    p = p.parent;
  }
  return false;
}

function walkDir(dir: string, out: string[]): void {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'i18n') walkDir(p, out);
    } else if (p.endsWith('.ts')) out.push(p);
  }
}

/** Every warning text site in `src/core` (outside `src/core/i18n`). */
export function warningSites(root = 'src/core'): WarningSite[] {
  const files: string[] = [];
  walkDir(root, files);
  const sites: WarningSite[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        (n.expression.text === 't' || n.expression.text === 'tx') &&
        isWarningContext(n)
      )
        sites.push({
          file,
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          keys: literals(n.arguments[0]),
        });
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return sites;
}

export const warningKeys = (): string[] => [
  ...new Set(warningSites().flatMap((s) => s.keys ?? [])),
];
export const dynamicSites = (): WarningSite[] => warningSites().filter((s) => !s.keys);

/** Every literal `t()`/`tx()` key in one core file, for the files whose texts fill a warning's `{reason}` or `{kind}`. */
export function fileKeys(file: string): string[] {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const keys: string[] = [];
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      (n.expression.text === 't' || n.expression.text === 'tx')
    )
      keys.push(...(literals(n.arguments[0]) ?? []));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return keys;
}
