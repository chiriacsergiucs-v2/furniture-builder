"""Tests for scripts/dups.py (cleanup audit item 15). Run by pnpm docs:check."""
import importlib.util
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("dups", pathlib.Path(__file__).with_name("dups.py"))
dups = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dups)


class Dups(unittest.TestCase):
    def test_a_block_in_two_files_is_one_group(self):
        with tempfile.TemporaryDirectory(dir=dups.ROOT) as tmp:
            d = pathlib.Path(tmp)
            body = "\n".join(f"const v{i} = {i} * 2;" for i in range(12))
            (d / "a.ts").write_text(body)
            (d / "b.ts").write_text("// other\n" + body)
            (d / "c.ts").write_text("const only = 1;\n")
            by_files, _ = dups.groups([d.relative_to(dups.ROOT).as_posix()])
            self.assertEqual(len(by_files), 1)
            (files,) = by_files
            self.assertEqual([pathlib.Path(f).name for f in files], ["a.ts", "b.ts"])

    def test_comments_blank_lines_and_braces_do_not_count(self):
        with tempfile.TemporaryDirectory(dir=dups.ROOT) as tmp:
            p = pathlib.Path(tmp) / "x.ts"
            p.write_text("// a\n\n}\nconst a = 1;\n  /* b */\n")
            self.assertEqual([s for _, s in dups.lines(p)], ["const a = 1;"])


if __name__ == "__main__":
    unittest.main()
