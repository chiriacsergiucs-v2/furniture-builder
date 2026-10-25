"""Tests for the gaps ledger and its Stop hook (ADR-082). Run by pnpm docs:check."""
import json, pathlib, tempfile, unittest

import gaps
import gaps_hook

ENTRY = """### G-001: Example

- Status: {status}
- Origin: ADR-001, 2026-10-25; agent scoped it out
- Missing: Something
- Request: “Build it”
- Questions: Build it?
- Suggested pick: Build it (estimate: effort +5%, value +5%)
"""


class LedgerTest(unittest.TestCase):
    def test_the_repository_ledger_is_valid(self):
        self.assertEqual(gaps.problems(gaps.LEDGER.read_text(), gaps.adr_statuses()), [])

    def test_a_missing_field_and_a_bad_status_are_errors(self):
        text = ENTRY.format(status="Maybe").replace("- Questions: Build it?\n", "")
        errors = gaps.problems(text, {})
        self.assertTrue(any("missing '- Questions:'" in e for e in errors))
        self.assertTrue(any("Status must be" in e for e in errors))

    def test_a_duplicate_id_is_an_error(self):
        text = ENTRY.format(status="Open") * 2
        self.assertIn("G-001 is listed twice", gaps.problems(text, {}))

    def test_a_gap_of_an_implemented_adr_must_be_done(self):
        text = ENTRY.format(status="ADR-007")
        self.assertTrue(any("mark the gap Done" in e for e in gaps.problems(text, {"007": "Implemented"})))
        self.assertEqual(gaps.problems(text, {"007": "Pending"}), [])
        self.assertTrue(any("unknown ADR-007" in e for e in gaps.problems(text, {})))

    def test_add_takes_the_next_id(self):
        gid, text = gaps.add(ENTRY.format(status="Open"), "Next", "o", "m", "r", "q", "p")
        self.assertEqual(gid, "G-002")
        self.assertEqual(gaps.ids(text), {"G-001", "G-002"})
        self.assertEqual(gaps.problems(text, {}), [])

    def test_sync_marks_gaps_of_implemented_adrs_done(self):
        text = ENTRY.format(status="ADR-007")
        new, changed = gaps.sync(text, {"007": "Implemented"})
        self.assertEqual(changed, ["G-001"])
        self.assertIn("- Status: Done (ADR-007)", new)
        self.assertEqual(gaps.sync(text, {"007": "Pending"}), (text, []))


def transcript(*entries):
    f = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
    f.write("\n".join(json.dumps(e) for e in entries))
    f.close()
    return f.name


def say(text):
    return {"type": "assistant", "message": {"content": [{"type": "text", "text": text}]}}


class HookTest(unittest.TestCase):
    def run_hook(self, reply, changed=False, active=False):
        path = transcript({"type": "user", "message": {"content": "go"}}, say(reply))
        try:
            return gaps_hook.decide({"transcript_path": path, "stop_hook_active": active}, lambda: changed)
        finally:
            pathlib.Path(path).unlink()

    def test_blocks_once_when_skipped_items_are_not_recorded(self):
        out = self.run_hook("Done.\n\n**Skipped this iteration**\n- the 3D outline")
        self.assertEqual(out["decision"], "block")
        self.assertIn("pnpm gaps add", out["reason"])

    def test_silent_when_the_ledger_changed_or_a_gap_is_cited(self):
        reply = "**Skipped this iteration**\n- the 3D outline"
        self.assertIsNone(self.run_hook(reply, changed=True))
        self.assertIsNone(self.run_hook(reply + " (G-012)"))

    def test_silent_on_a_plain_reply_and_on_the_second_stop(self):
        self.assertIsNone(self.run_hook("Merged PR #57."))
        self.assertIsNone(self.run_hook("Skipped this iteration: x", active=True))

    def test_only_the_last_reply_counts(self):
        path = transcript(say("Skipped this iteration: x"), {"type": "user", "message": {"content": "next"}},
                          say("All merged."))
        try:
            self.assertIsNone(gaps_hook.decide({"transcript_path": path}, lambda: False))
        finally:
            pathlib.Path(path).unlink()

    def test_uses_last_assistant_message_when_given(self):
        out = gaps_hook.decide({"last_assistant_message": "Out of scope: AR"}, lambda: False)
        self.assertEqual(out["decision"], "block")


if __name__ == "__main__":
    unittest.main()
