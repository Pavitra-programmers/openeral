# OpenShell clears image ENV for exec/SSH sessions. Supply defaults at invocation.
export AGENT_BROWSER_PROVIDER="${AGENT_BROWSER_PROVIDER-kernel}"
export KERNEL_ENDPOINT="${KERNEL_ENDPOINT-http://127.0.0.1:19300}"
export KERNEL_API_KEY="${KERNEL_API_KEY-openrind-compat}"
export KERNEL_HEADLESS="${KERNEL_HEADLESS-true}"
export KERNEL_STEALTH="${KERNEL_STEALTH-false}"
export KERNEL_TIMEOUT_SECONDS="${KERNEL_TIMEOUT_SECONDS-300}"
export AGENT_BROWSER_ACTION_POLICY="${AGENT_BROWSER_ACTION_POLICY-/opt/openrind/browser/agent-browser-policy.json}"
