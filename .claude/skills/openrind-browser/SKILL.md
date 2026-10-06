---
name: openrind-browser
description: Use the installed agent-browser CLI for web tasks when Openrind browser pods are enabled. Do not use this skill for Control Chrome or a local browser.
---

# Browser Pods

This path is experimental. It needs host-side browser activation. It does not
start a browser inside your agent sandbox. The `kernel` provider is an Openrind
adapter. It does not need a real Kernel account.

Before a web task, run these checks through Bash:

```bash
command -v agent-browser
agent-browser --version
node /opt/openrind-browser-pods/bin/helper-probe.mjs
```

If a check fails, report it. Do not install a browser, start a different provider,
change the endpoint, or weaken the website policy. Ordinary Claude tasks do not
need browser activation.

Use the installed CLI with its managed environment. Use a distinct session name
for each concurrent task. Reuse that name for all commands in the same task. The
name `web-task` below is an example, not a shared session for all agents.
Do not set an executable path or use `--cdp` or `--auto-connect`.

```bash
agent-browser --session web-task open https://example.com
agent-browser --session web-task snapshot -i
```

Use the element references from the snapshot for `click` and `fill`. Take another
snapshot after navigation. Ask for approval before a purchase, submission, or
other action that needs user consent. These instructions are not a server-side
action approval system.

```bash
agent-browser --session web-task screenshot /sandbox/work/page.png
agent-browser --session web-task close
```

Close only your task's browser session. `agent-browser close` does not stop Claude
or delete its FUSE workspace. Closing Claude does not prove that browser cleanup
completed. The broker enforces browser expiry and resource cleanup separately.

Screenshots return image bytes to the agent. Website downloads stay in the browser
pod. The managed action policy denies `upload` and `download`; the agent's local
paths do not exist in that pod. Artifact import and export are not available in
this initial implementation. Do not claim that a download reached `/sandbox/work`.

A failed health probe can make agent-browser delete the old browser and create
a new one. The page state is then lost. Inspect the current page before you act.
Do not repeat a purchase or submission after a connection error unless you first
check whether it completed. Website access is allowlist-only. Report a denied
destination instead of changing the policy.
