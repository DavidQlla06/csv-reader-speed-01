# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/DavidQlla06/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/DavidQlla06/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0: `solve.js` exports
`run(input)` returning exactly the reference's `{columns, rows, errors}`
for every `{text, header}` input — same broken-row policy (stray CRs,
quote junk, unterminated quotes, short/long rows, BOM, CRLF inside
quotes), at a fraction of the CPU.

How it stays fast: one left-to-right pass; each record finds its line
end once, unquoted fields end at `indexOf` jumps, quoted fields jump
quote to quote, and every field is a slice of the input — nothing is
built character by character. CR positions are indexed once per input
so stray-CR checks are O(1).

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` reads `cases.json` from the input directory, answers each
case with `run()` from `solve.js`, and writes `answers.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=56285tn4&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
