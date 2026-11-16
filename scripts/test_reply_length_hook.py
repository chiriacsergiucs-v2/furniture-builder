"""The reply-length Stop hook (N315)."""
import json, pathlib, subprocess, sys, unittest

import reply_length_hook as hook


def reply(n):
    return " ".join(["word"] * n)


class ReplyLengthTest(unittest.TestCase):
    def test_a_short_reply_passes(self):
        self.assertIsNone(hook.decide({"last_assistant_message": reply(hook.MAX_WORDS)}))

    def test_a_long_reply_is_blocked_once(self):
        out = hook.decide({"last_assistant_message": reply(hook.MAX_WORDS + 1)})
        self.assertEqual(out["decision"], "block")
        self.assertIn(str(hook.MAX_WORDS + 1), out["reason"])
        self.assertIsNone(hook.decide({"last_assistant_message": reply(400), "stop_hook_active": True}))

    def test_the_long_marker_passes_a_deliverable(self):
        self.assertIsNone(hook.decide({"last_assistant_message": "[long] " + reply(400)}))

    def test_fenced_code_does_not_count(self):
        text = "Done.\n```\n" + reply(500) + "\n```\nPushed."
        self.assertIsNone(hook.decide({"last_assistant_message": text}))

    def test_the_hook_as_it_runs_with_isolated_python(self):
        data = json.dumps({"last_assistant_message": reply(300)})
        out = subprocess.run([sys.executable, "-I", str(pathlib.Path(hook.__file__))], input=data,
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 0)
        self.assertEqual(json.loads(out.stdout)["decision"], "block")
        bad = subprocess.run([sys.executable, "-I", str(pathlib.Path(hook.__file__))], input="not json",
                             capture_output=True, text=True)
        self.assertEqual((bad.returncode, bad.stdout), (0, ""))


if __name__ == "__main__":
    unittest.main()
