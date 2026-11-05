"""Tests for the docs-only matcher in .github/workflows/ci.yml (ADR-197). Run by pnpm docs:check.

The matcher is taken verbatim from the workflow (between its BEGIN and END comments) and run with bash, so the
tested text is the text CI runs.
"""
import pathlib, re, subprocess, textwrap, unittest

CI = pathlib.Path(__file__).resolve().parent.parent / ".github" / "workflows" / "ci.yml"


def matcher():
    text = CI.read_text()
    m = re.search(r"\n( *)# BEGIN docs-only matcher\n(.*?)\n *# END docs-only matcher", text, re.S)
    assert m, "docs-only matcher markers not found in ci.yml"
    return textwrap.dedent(m.group(1) + "# BEGIN\n" + m.group(2))


def docs_only(paths):
    out = subprocess.run(
        ["bash", "-ec", matcher() + "\ndocs_only_list"],
        input="".join(p + "\n" for p in paths),
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


class DocsOnlyTest(unittest.TestCase):
    def test_docs_only_changes(self):
        for paths in (
            ["docs/backlog.md"],
            [".claude/skills/x/SKILL.md"],
            ["docs/adr/ADR-197-x.md"],
            ["docs/backlog.md", ".claude/skills/x/SKILL.md", "docs/adr/ADR-197-x.md", "docs/adr/README.md"],
            ["docs/adr/_template.md", "docs/retros/a/b.md", "docs/product/product-context.md"],
            ["docs/architecture.md", "docs/ui-design.md", "CLAUDE.md", ".claude/settings.json"],
        ):
            with self.subTest(paths=paths):
                self.assertEqual(docs_only(paths), "true")

    def test_changes_that_need_the_full_run(self):
        for paths in (
            ["docs/adr/GAPS.md"],
            ["docs/adr/GAPS-archive.md"],
            ["docs/research/a.md"],
            ["docs/catalog.md"],
            ["docs/samples/a.project.json"],
            ["docs/adr-done/ADR-1-x.md"],
            ["src/x.ts"],
            ["package.json"],
            [".github/workflows/ci.yml"],
            ["docs/backlog.md", "src/x.ts"],
            ["src/x.ts", "docs/backlog.md"],
            ["docs/adr/ADR-197-x.txt"],
            ["deleted:docs/adr/ADR-191-x.md"],
            ["docs/backlog.md", "deleted:docs/backlog.md"],
            [],
            ["docs/backlog.md"] * 300,
        ):
            with self.subTest(paths=paths[:3], n=len(paths)):
                self.assertEqual(docs_only(paths), "false")

    def test_no_code_reads_a_docs_only_file(self):
        # A file the app, a test or a script reads cannot be docs-only: changing it must run the tests. Only
        # docs/adr's file names are read (sync-pending); deleting or renaming one is not docs-only (above).
        root = CI.parent.parent.parent
        reads = re.compile(
            r"(\b(readFileSync|readdirSync|existsSync)\([^;\n]*|\bfrom\s+|\bimport\s*\(\s*)['\"`][^'\"`]*"
            r"(docs/(backlog|architecture|ui-design)\.md|docs/(retros|product)/|docs/adr/(README|_template|ADR-)"
            r"|CLAUDE\.md|\.claude/)"
        )
        files = [
            f
            for d in ("src", "tests", "scripts", "tools")
            for f in (root / d).rglob("*")
            if f.suffix in (".ts", ".tsx", ".mjs", ".js") and "node_modules" not in f.parts
        ] + [root / "vite.config.ts"]
        hits = [f"{f.relative_to(root)}: {m.group(0)}" for f in files for m in reads.finditer(f.read_text())]
        self.assertEqual(hits, [])

    def test_just_under_the_file_limit_is_docs_only(self):
        self.assertEqual(docs_only(["docs/backlog.md"] * 299), "true")


if __name__ == "__main__":
    unittest.main()
