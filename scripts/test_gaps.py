"""Tests for the gaps ledger and its Stop hook (ADR-082). Run by pnpm docs:check."""
import datetime, json, pathlib, subprocess, sys, tempfile, unittest

import gaps
import gaps_hook

ENTRY = """### Example

- Id: 0b6c2a1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d
- Number: G-001 12:00
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
        self.assertIn("G-001 12:00 Example: Id 0b6c2a1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d is listed twice",
                      gaps.problems(text, {}))

    def test_a_bad_id_or_number_is_an_error(self):
        text = ENTRY.format(status="Open").replace("0b6c2a1e-", "x-").replace("G-001 12:00", "G-001")
        errors = gaps.problems(text, {})
        self.assertTrue(any("Id must be a lowercase UUID" in e for e in errors))
        self.assertTrue(any("Number must be 'G-NNN HH:MM'" in e for e in errors))

    def test_parse_reads_id_number_and_title(self):
        (g,) = gaps.parse(ENTRY.format(status="Open"))
        self.assertEqual((g["id"], g["number"], g["name"], g["title"]),
                         ("0b6c2a1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d", "G-001", "Example", "G-001 12:00 Example"))

    def test_a_gap_of_an_implemented_adr_must_be_done(self):
        text = ENTRY.format(status="ADR-007")
        self.assertTrue(any("mark the gap Done" in e for e in gaps.problems(text, {"007": "Implemented"})))
        self.assertEqual(gaps.problems(text, {"007": "Pending"}), [])
        self.assertTrue(any("unknown ADR-007" in e for e in gaps.problems(text, {})))

    def test_add_takes_the_next_number_the_time_and_a_new_uuid(self):
        now = datetime.datetime(2026, 10, 29, 9, 5, tzinfo=datetime.timezone.utc)
        title, text = gaps.add(ENTRY.format(status="Open"), "Next", "o", "m", "r", "q", "p", now)
        self.assertEqual(title, "G-002 09:05 Next")
        self.assertEqual(gaps.numbers(text), {"G-001", "G-002"})
        self.assertEqual(len(gaps.ids(text)), 2)
        self.assertEqual(gaps.problems(text, {}), [])

    def test_sync_marks_gaps_of_implemented_adrs_done(self):
        text = ENTRY.format(status="ADR-007")
        new, changed = gaps.sync(text, {"007": "Implemented"})
        self.assertEqual(changed, ["G-001 12:00 Example"])
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


class HookGitTest(unittest.TestCase):
    """The hook as the Stop hook runs it: JSON on stdin, the ledger state read from git in `cwd`."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.repo = pathlib.Path(self.dir.name)
        (self.repo / "docs/adr").mkdir(parents=True)
        (self.repo / gaps_hook.LEDGER).write_text(ENTRY.format(status="Open"))
        for args in (["init", "-q"], ["add", "-A"], ["commit", "-qm", "base"]):
            subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args], cwd=self.repo,
                           check=True, capture_output=True)

    def tearDown(self):
        self.dir.cleanup()

    def stop(self, reply):
        data = json.dumps({"cwd": str(self.repo), "stop_hook_active": False, "last_assistant_message": reply})
        out = subprocess.run([sys.executable, "-I", str(pathlib.Path(gaps_hook.__file__))], input=data,
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 0)
        return json.loads(out.stdout) if out.stdout.strip() else None

    def test_asks_while_the_ledger_is_unchanged_and_is_silent_once_it_changed(self):
        reply = "**Skipped this iteration**\n- the 3D outline"
        self.assertEqual(self.stop(reply)["decision"], "block")
        with (self.repo / gaps_hook.LEDGER).open("a") as f:
            f.write("\n")
        self.assertIsNone(self.stop(reply))

    def test_silent_on_a_plain_reply_and_on_bad_input(self):
        self.assertIsNone(self.stop("Merged PR #57."))
        out = subprocess.run([sys.executable, "-I", str(pathlib.Path(gaps_hook.__file__))], input="not json",
                             capture_output=True, text=True)
        self.assertEqual((out.returncode, out.stdout), (0, ""))


if __name__ == "__main__":
    unittest.main()
