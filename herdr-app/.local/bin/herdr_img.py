"""Open an image in a Herdr pane next to the calling agent's terminal.

Usage: herdr-img <path> [--down] [--machine NAME]
  --down          split below instead of to the right
  --machine NAME  the file is on that hc machine (e.g. laptop), not this computer
"""
import json
import os
import subprocess
import sys


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0 if argv else 2
    direction, machine, path = "right", None, None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--down":
            direction = "down"
        elif a == "--machine":
            i += 1
            machine = argv[i]
        else:
            path = a
        i += 1
    if not path:
        print("herdr-img: no path given", file=sys.stderr)
        return 2
    if machine is None:
        path = os.path.abspath(path)
        if not os.path.isfile(path):
            print(f"herdr-img: no such file: {path}", file=sys.stderr)
            return 1
    path = path.replace("\\", "/")

    args = {"direction": direction, "mod": "image-view", "props": {"file": path, "machine": machine}}
    me = os.environ.get("HC_TERMINAL_ID")
    if me:
        ls = subprocess.run(["herdr-app", "ls"], capture_output=True, text=True, encoding="utf-8")
        try:
            for space in json.loads(ls.stdout)["spaces"]:
                for tab in space["tabs"]:
                    for t in tab["terminals"]:
                        if t.get("terminal") == me and t.get("pane"):
                            args["pane"] = t["pane"]
        except (ValueError, KeyError):
            pass
    r = subprocess.run(["herdr-app", "do", "pane.split", json.dumps(args)], capture_output=True, text=True, encoding="utf-8")
    sys.stdout.write(r.stdout)
    sys.stderr.write(r.stderr)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
