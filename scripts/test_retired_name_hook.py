"""Tests for scripts/retired_name_hook.py, the Claude Code hook that blocks git commit and push while the retired
agent tool's name is back (user decision 2026-11-10). Run by pnpm docs:check.

Each test builds a throwaway git repository, so the real one is never touched. Sample names are built from parts so
this file never matches the guard itself.
"""
import json, pathlib, re, shutil, subprocess, sys, tempfile, unittest

SCRIPTS = pathlib.Path(__file__).resolve().parent
HOOK = SCRIPTS / "retired_name_hook.py"
SAMPLE = "Claude" + "-" + "Flow"
SHORT = "Ru" + "flo"


def run_hook(cwd, command):
    event = {"tool_name": "Bash", "tool_input": {"command": command}, "cwd": str(cwd)}
    return subprocess.run([sys.executable, "-I", str(HOOK)], input=json.dumps(event), capture_output=True, text=True)


class RetiredNameHookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="retired-hook-"))
        subprocess.run(["git", "init", "-q"], cwd=self.tmp, check=True)
        (self.tmp / "notes.md").write_text("clean text about agent-config folders\n")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_same_pattern_as_docs_check(self):
        line = re.search(r"^RETIRED = (re\.compile\(.+\))$", (SCRIPTS / "check-docs.py").read_text(), re.M)
        self.assertIsNotNone(line, "RETIRED not found in check-docs.py")
        docs = eval(line.group(1), {"re": re})  # noqa: S307 - our own source line
        sys.path.insert(0, str(SCRIPTS))
        import retired_name_hook  # noqa: E402

        self.assertEqual((docs.pattern, docs.flags), (retired_name_hook.RETIRED.pattern, retired_name_hook.RETIRED.flags))

    def test_clean_repo_allows_commit_and_push(self):
        self.assertEqual(run_hook(self.tmp, "git add -A && git commit -m x").returncode, 0)
        self.assertEqual(run_hook(self.tmp, "git push -u origin HEAD").returncode, 0)

    def test_blocks_commit_when_text_names_the_tool(self):
        (self.tmp / "notes.md").write_text("first\nwe used " + SAMPLE + "\n")
        out = run_hook(self.tmp, "git commit -am x")
        self.assertEqual(out.returncode, 2)
        self.assertIn("notes.md:2: names the retired agent tool", out.stderr)

    def test_blocks_push_when_a_file_name_names_the_tool(self):
        (self.tmp / (SHORT.lower() + ".md")).write_text("clean\n")
        out = run_hook(self.tmp, "cd . && git push origin main")
        self.assertEqual(out.returncode, 2)
        self.assertIn("file name names the retired agent tool", out.stderr)

    def test_other_commands_are_never_blocked(self):
        (self.tmp / "notes.md").write_text(SAMPLE + "\n")
        for command in ("ls", "git status", "git log --oneline", "pnpm test", "echo commit"):
            self.assertEqual(run_hook(self.tmp, command).returncode, 0, command)

    def test_binary_files_are_checked_by_name_only(self):
        (self.tmp / "logo.png").write_bytes(b"\x89PNG\xff\xfe" + SAMPLE.encode())
        self.assertEqual(run_hook(self.tmp, "git commit -m x").returncode, 0)


if __name__ == "__main__":
    unittest.main()
