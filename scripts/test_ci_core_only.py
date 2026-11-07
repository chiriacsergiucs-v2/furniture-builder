"""Tests for the core-only matcher in .github/workflows/ci.yml (ADR-201, G-368). Run by pnpm docs:check.

The core-only matcher calls docs_only_path from the docs-only matcher, so both blocks are taken verbatim from the
workflow (between their BEGIN and END comments) and run with bash: the tested text is the text CI runs.
"""
import pathlib, re, subprocess, textwrap, unittest

CI = pathlib.Path(__file__).resolve().parent.parent / ".github" / "workflows" / "ci.yml"


def block(name):
    text = CI.read_text()
    m = re.search(r"\n( *)# BEGIN " + name + r" matcher\n(.*?)\n *# END " + name + " matcher", text, re.S)
    assert m, f"{name} matcher markers not found in ci.yml"
    return textwrap.dedent(m.group(1) + "# BEGIN\n" + m.group(2))


def core_only(paths):
    out = subprocess.run(
        ["bash", "-ec", block("docs-only") + "\n" + block("core-only") + "\ncore_only_list"],
        input="".join(p + "\n" for p in paths),
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


class CoreOnlyTest(unittest.TestCase):
    def test_core_only_changes(self):
        for paths in (
            ["src/core/geometry.ts"],
            ["src/core/i18n/ru/ui.ts"],
            ["src/core/a.ts", "src/core/b/c.ts"],
            ["src/core/a.ts", "docs/backlog.md"],
            ["docs/adr/ADR-201-x.md", "src/core/a.ts", ".claude/skills/x/SKILL.md", "CLAUDE.md"],
        ):
            with self.subTest(paths=paths):
                self.assertEqual(core_only(paths), "true")

    def test_changes_that_need_the_full_run(self):
        for paths in (
            [],
            ["docs/backlog.md"],  # docs-only: no tests at all, not the --changed run
            ["src/ui/App.tsx"],
            ["src/store/design.ts"],
            ["src/corex.ts"],
            ["src/core"],
            ["tests/a.test.ts"],
            ["src/core/a.ts", "tests/a.test.ts"],
            ["tests/a.test.ts", "src/core/a.ts"],
            ["src/core/a.ts", "package.json"],
            ["src/core/a.ts", "pnpm-lock.yaml"],
            ["src/core/a.ts", "vite.config.ts"],
            ["src/core/a.ts", ".github/workflows/ci.yml"],
            ["src/core/a.ts", "docs/adr/GAPS.md"],
            ["src/core/a.ts", "docs/catalog.md"],
            ["deleted:src/core/a.ts"],
            ["src/core/b.ts", "deleted:src/core/a.ts"],
            ["src/core/a.ts"] * 300,
        ):
            with self.subTest(paths=paths[:3], n=len(paths)):
                self.assertEqual(core_only(paths), "false")

    def test_just_under_the_file_limit_is_core_only(self):
        self.assertEqual(core_only(["src/core/a.ts"] * 299), "true")

    def test_the_test_job_uses_the_output(self):
        # The full suite stays the default: --changed runs only when core_only is true, and main pushes never
        # compute it (the matcher runs only for pull_request events).
        text = CI.read_text()
        self.assertIn('if [ "$EVENT" = pull_request ]', text)
        self.assertIn("core_only=false", text)
        self.assertRegex(text, r"--changed[^\n]*--passWithNoTests[^\n]*--shard=")


if __name__ == "__main__":
    unittest.main()
