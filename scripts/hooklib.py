"""Shared by the Claude Code Stop hooks (gaps_hook.py, reply_length_hook.py): the last reply of the agent."""
import json, pathlib


def last_reply(data):
    """The text of the agent's last reply: `last_assistant_message` when the hook input has it, else read from the
    transcript, from the last real user turn on."""
    if isinstance(data.get("last_assistant_message"), str):
        return data["last_assistant_message"]
    path = data.get("transcript_path")
    if not path:
        return ""
    texts = []
    for line in pathlib.Path(path).read_text().splitlines():
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        msg = entry.get("message") or {}
        content = msg.get("content")
        if entry.get("type") == "user":
            # A real user turn (not a tool result) starts a new reply.
            if isinstance(content, str) or any(c.get("type") == "text" for c in content or [] if isinstance(c, dict)):
                texts = []
        elif entry.get("type") == "assistant" and isinstance(content, list):
            texts += [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
    return "\n".join(texts)
