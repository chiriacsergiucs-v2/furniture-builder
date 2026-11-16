"""The id-collision PreToolUse hook (N315)."""
import pathlib, subprocess, tempfile, unittest

import id_collision_hook as hook


def git(cwd, *args):
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args], cwd=cwd, check=True, capture_output=True)


BACKLOG = "| ID | Item |\n| N1 | one |\n"
GAPS = "### G-001: first\n\n- Status: Open\n"


class PureTest(unittest.TestCase):
    def test_ids_of_each_kind(self):
        self.assertEqual(hook.backlog_ids("| N5 | x |\n| D2 | y |\n| F3 | z |\n| ID | h |"), {"N5", "D2", "F3"})
        self.assertEqual(hook.gap_ids("### G-509: t\n### G-1: no"), {"G-509"})
        self.assertEqual(hook.adr_ids(["docs/adr/ADR-272-x.md", "docs/adr-done/ADR-015-y.md", "docs/adr/README.md"]),
                         {"ADR-272", "ADR-015"})

    def test_only_ids_added_on_the_branch_collide(self):
        self.assertEqual(hook.collisions({"N1"}, {"N1", "N2", "N3"}, {"N1", "N2", "N4"}), ["N2"])
        self.assertEqual(hook.collisions({"N1"}, {"N1"}, {"N1", "N2"}), [])

    def test_next_free_per_kind(self):
        free = hook.next_free({"N9", "N314", "G-516", "ADR-278", "D3"})
        self.assertEqual((free["N"], free["G-"], free["ADR-"], free["D"]), ("N315", "G-517", "ADR-" + str(279), "D4"))


class GitTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.dir.name)
        self.remote, self.mine, self.other = root / "remote.git", root / "mine", root / "other"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.remote)], check=True)
        subprocess.run(["git", "clone", "-q", str(self.remote), str(self.mine)], check=True, capture_output=True)
        (self.mine / "docs/adr").mkdir(parents=True)
        (self.mine / "docs/backlog.md").write_text(BACKLOG)
        (self.mine / "docs/adr/GAPS.md").write_text(GAPS)
        git(self.mine, "checkout", "-q", "-b", "main")
        git(self.mine, "add", "-A")
        git(self.mine, "commit", "-qm", "base")
        git(self.mine, "push", "-q", "-u", "origin", "main")
        subprocess.run(["git", "clone", "-q", str(self.remote), str(self.other)], check=True, capture_output=True)
        git(self.mine, "checkout", "-q", "-b", "work")

    def tearDown(self):
        self.dir.cleanup()

    def add(self, repo, row, gap, branch_message):
        with (repo / "docs/backlog.md").open("a") as f:
            f.write(row)
        with (repo / "docs/adr/GAPS.md").open("a") as f:
            f.write(gap)
        git(repo, "add", "-A")
        git(repo, "commit", "-qm", branch_message)

    def test_a_clash_is_found_and_the_next_free_ids_are_named(self):
        self.add(self.mine, "| N2 | mine |\n", "\n### G-002: mine\n\n- Status: Open\n", "mine")
        self.add(self.other, "| N2 | theirs |\n", "\n### G-002: theirs\n\n- Status: Open\n", "theirs")
        git(self.other, "push", "-q", "origin", "main")
        bad, free = hook.find(self.mine)
        self.assertEqual(bad, ["G-002", "N2"])
        self.assertEqual((free["N"], free["G-"]), ("N3", "G-003"))

    def test_no_clash_when_main_added_other_ids(self):
        self.add(self.mine, "| N2 | mine |\n", "", "mine")
        self.add(self.other, "| N3 | theirs |\n", "", "theirs")
        git(self.other, "push", "-q", "origin", "main")
        self.assertEqual(hook.find(self.mine)[0], [])

    def test_an_uncommitted_row_counts(self):
        self.add(self.other, "| N2 | theirs |\n", "", "theirs")
        git(self.other, "push", "-q", "origin", "main")
        with (self.mine / "docs/backlog.md").open("a") as f:
            f.write("| N2 | mine, not committed |\n")
        self.assertEqual(hook.find(self.mine)[0], ["N2"])


if __name__ == "__main__":
    unittest.main()
