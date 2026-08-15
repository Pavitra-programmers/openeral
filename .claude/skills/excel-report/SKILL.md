---
name: excel-report
description: Create an auditable Markdown report for uploaded Microsoft Excel .xlsx workbooks in an Openrind Shell sandbox.
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash, Glob
argument-hint: [path to .xlsx file]
---

# Excel Reporting

Perform the analysis yourself when this skill loads; skills do not run background
jobs. Never claim a workbook was analyzed until the parsing command succeeds.

## Locate Input And Output

Determine the runtime first:

```bash
if mountpoint -q /sandbox/work 2>/dev/null; then
  INBOX=/sandbox/work/inbox
else
  INBOX=/sandbox/inbox
fi
mkdir -p "$INBOX"
find "$INBOX" /sandbox -maxdepth 3 -type f -iname '*.xlsx' -print 2>/dev/null
```

Prefer the persisted FUSE inbox when available. In compatibility mode, `/sandbox/inbox`
is sandbox-local unless it lies under an explicitly synchronized prefix.

## Read Workbooks

Use Python rather than `cat`:

```bash
uv venv /tmp/openrind-excel-venv
uv pip install --python /tmp/openrind-excel-venv openpyxl pandas tabulate
```

Write a short parser under `/tmp` that calls
`pandas.read_excel(path, sheet_name=None)` and prints, for every worksheet:

- row and column counts;
- column names and data types;
- null and duplicate counts;
- date/numeric ranges and descriptive statistics;
- a small sample used only to validate interpretation.

Run it with `/tmp/openrind-excel-venv/bin/python` against the absolute workbook paths.
Do not include secrets or unnecessary row-level personal data in the report.

## Report Contract

Create `$INBOX/analysis-report.md` with:

1. Executive Summary
2. Data Scope
3. Key Metrics And Statistics
4. Detailed Findings
5. Data-Quality Risks
6. Next Steps

Tie each finding to a named workbook, sheet, and column. Distinguish observed facts
from inference. Report parsing errors and unsupported workbook features explicitly.
After writing the file, tell the user its exact path and include the report in chat.
