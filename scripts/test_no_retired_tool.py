"""Tests for the retired-tool guard in scripts/retired_names.py (user decision 2026-11-10). Run by pnpm docs:check."""
import pathlib, sys, unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import retired_names  # noqa: E402

TOOL = "claude" + "-" + "flow"
NEW_NAME = "Ru" + "flo"


class RetiredNamesTest(unittest.TestCase):
    def test_flags_a_file_name(self):
        self.assertEqual(len(retired_names.problems(f"docs/{TOOL}/notes.md", "")), 1)

    def test_flags_each_matching_line(self):
        text = f"intro\nuses {TOOL.upper()} here\nand {NEW_NAME} there\nend"
        self.assertEqual(
            retired_names.problems("docs/a.md", text),
            ["docs/a.md:2: names the retired agent tool", "docs/a.md:3: names the retired agent tool"],
        )

    def test_flags_spaced_and_joined_spellings(self):
        for spelled in ("claude" + " " + "flow", "claude" + "_" + "flow", "claude" + "flow"):
            self.assertTrue(retired_names.problems("a.md", spelled), spelled)

    def test_passes_clean_text_and_binary_files(self):
        self.assertEqual(retired_names.problems("docs/a.md", "Claude workflows and data flows"), [])
        self.assertEqual(retired_names.problems("public/a.png", None), [])

    def test_guard_files_do_not_match_themselves(self):
        here = pathlib.Path(__file__).resolve().parent
        for name in ("retired_names.py", "test_no_retired_tool.py"):
            self.assertEqual(retired_names.problems(name, (here / name).read_text()), [], name)


if __name__ == "__main__":
    unittest.main()
