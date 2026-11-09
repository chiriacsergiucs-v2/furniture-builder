"""Tests for the retired agent-tool guard in scripts/check-docs.py (user decision 2026-11-10). Run by pnpm docs:check.

The checker runs on a throwaway copy of the docs, the scripts and the research record (a fresh git repository in a
temporary folder), so the real repository is never touched. The sample name is built from parts so this file never
matches the guard itself.
"""
import pathlib, shutil, subprocess, tempfile, unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
RESEARCH = "src/core/research/ensemble-2026-10-23.features.ts"
SAMPLE = "Claude" + "-" + "Flow"
SHORT = "Ru" + "flo"


class RetiredToolGuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="retired-tool-"))
        shutil.copytree(REPO / "docs", self.tmp / "docs")
        shutil.copytree(REPO / "scripts", self.tmp / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
        (self.tmp / RESEARCH).parent.mkdir(parents=True)
        shutil.copy(REPO / RESEARCH, self.tmp / RESEARCH)
        subprocess.run(["git", "init", "-q"], cwd=self.tmp, check=True)
        subprocess.run(["git", "add", "-A"], cwd=self.tmp, check=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def docs_check(self):
        return subprocess.run(["python3", "-I", "scripts/check-docs.py"], cwd=self.tmp, capture_output=True, text=True)

    def add(self, rel, text):
        p = self.tmp / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        subprocess.run(["git", "add", rel], cwd=self.tmp, check=True)

    def test_clean_text_passes(self):
        self.add("docs/notes.md", "The retired agent-config folder held the contracts.\n")
        out = self.docs_check()
        self.assertNotIn("retired agent tool", out.stdout)

    def test_flags_name_in_content_with_line(self):
        self.add("docs/notes.md", "first line\nwe used " + SAMPLE + " here\n")
        out = self.docs_check()
        self.assertIn("ERROR docs/notes.md:2: names the retired agent tool", out.stdout)
        self.assertNotEqual(out.returncode, 0)

    def test_flags_short_name_and_spaced_variant(self):
        self.add("docs/notes.md", SHORT.lower() + "\nclaude" + " " + "flow\n")
        out = self.docs_check()
        self.assertIn("docs/notes.md:1:", out.stdout)
        self.assertIn("docs/notes.md:2:", out.stdout)

    def test_flags_name_in_file_name(self):
        self.add("docs/" + SAMPLE.lower() + "-notes.md", "clean\n")
        out = self.docs_check()
        self.assertIn("file name names the retired agent tool", out.stdout)
        self.assertNotEqual(out.returncode, 0)


if __name__ == "__main__":
    unittest.main()
