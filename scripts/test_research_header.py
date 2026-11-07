"""Tests for the "- Research:" ADR header check (ADR-212, G-076). Run by pnpm docs:check.

Both checkers run on a throwaway copy of the docs, the scripts and the research record (a fresh git repository in a
temporary folder), so the real ledger is never touched:
- scripts/check-docs.py rejects an unknown research id on a pending ADR, accepts a known one, and ignores the line
  on an implemented ADR (a shipped ADR deleted the features it built);
- .claude/skills/ship-adr/ship-adr.sh stops on an unknown id before changing anything, and lists the known ones.
"""
import pathlib, re, shutil, subprocess, tempfile, unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
RESEARCH = "src/core/research/ensemble-2026-10-23.features.ts"
SHIP = ".claude/skills/ship-adr/ship-adr.sh"


def known_id():
    return re.search(r"\bF\('([a-z0-9-]+)'", (REPO / RESEARCH).read_text()).group(1)


class ResearchHeaderTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="research-header-"))
        shutil.copytree(REPO / "docs", self.tmp / "docs")
        shutil.copytree(REPO / "scripts", self.tmp / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
        (self.tmp / RESEARCH).parent.mkdir(parents=True)
        shutil.copy(REPO / RESEARCH, self.tmp / RESEARCH)
        (self.tmp / SHIP).parent.mkdir(parents=True)
        shutil.copy(REPO / SHIP, self.tmp / SHIP)
        git = ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"]
        subprocess.run(["git", "init", "-q"], cwd=self.tmp, check=True)
        subprocess.run(["git", "add", "-A"], cwd=self.tmp, check=True)
        subprocess.run(git + ["commit", "-qm", "base"], cwd=self.tmp, check=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def pending(self):
        return sorted((self.tmp / "docs/adr").glob("ADR-[0-9][0-9][0-9]-*.md"))[0]

    def implemented(self):
        return sorted((self.tmp / "docs/adr-done").glob("ADR-[0-9][0-9][0-9]-*.md"))[0]

    def name(self, adr, ids):
        text = adr.read_text()
        text = re.sub(r"^(- Date: .+)$", lambda m: m.group(1) + "\n- Research: " + ids, text, count=1, flags=re.M)
        adr.write_text(text)

    def docs_check(self):
        return subprocess.run(["python3", "-I", "scripts/check-docs.py"], cwd=self.tmp, capture_output=True, text=True)

    def ship(self, adr):
        num = adr.name[4:7]
        return subprocess.run(["bash", SHIP, num], cwd=self.tmp, capture_output=True, text=True)

    def test_baseline_copy_passes(self):
        out = self.docs_check()
        self.assertNotIn("unknown research feature", out.stdout)

    def test_docs_check_rejects_unknown_id_on_pending_adr(self):
        self.name(self.pending(), "ens.f.no-such-feature-xyz")
        out = self.docs_check()
        self.assertEqual(out.returncode, 1, out.stdout)
        self.assertIn("unknown research feature 'ens.f.no-such-feature-xyz'", out.stdout)
        self.assertIn(self.pending().name, out.stdout)

    def test_docs_check_accepts_known_id_both_spellings(self):
        kid = known_id()
        self.name(self.pending(), f"ens.f.{kid}, {kid}")
        out = self.docs_check()
        self.assertNotIn("unknown research feature", out.stdout)

    def test_docs_check_ignores_implemented_adrs(self):
        self.name(self.implemented(), "ens.f.no-such-feature-xyz")
        out = self.docs_check()
        self.assertNotIn("unknown research feature", out.stdout)

    def test_ship_stops_on_unknown_id_before_changing_anything(self):
        adr = self.pending()
        self.name(adr, f"ens.f.{known_id()}, ens.f.no-such-feature-xyz")
        before = adr.read_text()
        out = self.ship(adr)
        self.assertEqual(out.returncode, 1, out.stdout + out.stderr)
        self.assertIn("names research feature 'ens.f.no-such-feature-xyz'", out.stderr)
        self.assertTrue(adr.exists())
        self.assertEqual(adr.read_text(), before)
        self.assertFalse((self.tmp / "docs/adr-done" / adr.name).exists())

    def test_ship_lists_known_ids(self):
        adr = self.pending()
        kid = known_id()
        self.name(adr, kid)
        out = self.ship(adr)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        self.assertIn("Research features to update", out.stdout)
        self.assertIn(f"ens.f.{kid}", out.stdout)
        self.assertTrue((self.tmp / "docs/adr-done" / adr.name).exists())


if __name__ == "__main__":
    unittest.main()
