"""Tests for scripts/ledger_gates.py (retro 2026-11-20, P4 and P10). Run by pnpm docs:check."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("ledger_gates", pathlib.Path(__file__).with_name("ledger_gates.py"))
gates = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gates)

GOOD_MARKER = "burst-skipped: live-verify (burst, 2026-11-21; blocker: proxy refuses github.io; cost: S)"


class BacklogGates(unittest.TestCase):
    def test_done_row_saying_not_merged_fails(self):
        (err,) = gates.backlog_problems([("N400", "Done", "PR #9 open, not merged")])
        self.assertIn("N400 is Done", err)

    def test_done_row_with_burst_debt_fails(self):
        errs = gates.backlog_problems([("N400", "Done", GOOD_MARKER)])
        self.assertEqual(len(errs), 1)
        self.assertIn("burst-skipped:", errs[0])

    def test_partially_done_row_with_full_marker_passes(self):
        self.assertEqual(gates.backlog_problems([("N400", "Partially done", GOOD_MARKER)]), [])

    def test_bare_burst_marker_fails(self):
        (err,) = gates.backlog_problems([("N400", "Partially done", "burst-skipped: live-verify (burst, 2026-11-21)")])
        self.assertIn("blocker", err)

    def test_marker_without_cost_letter_fails(self):
        bad = "burst-skipped: fuzz (burst, 2026-11-21; blocker: scope; cost: large)"
        self.assertEqual(len(gates.backlog_problems([("N400", "Partially done", bad)])), 1)

    def test_one_good_and_one_bare_marker_fails(self):
        evidence = GOOD_MARKER + "; burst-skipped: fuzz"
        self.assertEqual(len(gates.backlog_problems([("N400", "Partially done", evidence)])), 1)

    def test_legacy_rows_are_exempt(self):
        rows = [("N360", "Done", "not merged"), ("F18", "Done", "PR open"), ("D03", "Partially done", "burst-skipped: x")]
        self.assertEqual(gates.backlog_problems(rows), [])

    def test_first_new_ids_are_checked(self):
        rows = [("N361", "Done", "not merged"), ("F19", "Done", "not merged"), ("D04", "Done", "not merged")]
        self.assertEqual(len(gates.backlog_problems(rows)), 3)


class AdrGates(unittest.TestCase):
    def test_unchecked_item_without_gap_fails(self):
        (err,) = gates.adr_problems("docs/adr-done/new.md", "281", "Implemented", "- [x] a\n- [ ] b\n")
        self.assertTrue(err.startswith("docs/adr-done/new.md:2:"))

    def test_unchecked_item_naming_a_gap_passes(self):
        self.assertEqual(gates.adr_problems("a.md", "281", "Implemented", "- [ ] b (G-600)\n"), [])

    def test_pending_and_legacy_adrs_are_exempt(self):
        self.assertEqual(gates.adr_problems("a.md", "281", "Pending", "- [ ] b\n"), [])
        self.assertEqual(gates.adr_problems("a.md", "280", "Implemented", "- [ ] b\n"), [])


if __name__ == "__main__":
    unittest.main()
