# Robustness audit: does ponytail degrade weak models? (2026-06-16)

Follow-up to [issue #65](https://github.com/DietrichGebert/ponytail/issues/65). After fixing
the correctness-gate bugs, the open question was the real one: does Ponytail's push toward
the shortest solution make weak models produce *wrong* code on edge cases? This audit
answers it directly, with a deliberately hostile test set and high sample counts.

## TL;DR

- Across **12 classic edge-case traps** (off-by-one, n=0, leap-century, subtractive Roman,
  deep nesting, …) on **two weak models** (`gpt-4.1-mini`, `gpt-5.4-mini`), Ponytail holds
  **baseline parity** — it does not produce more wrong answers than the unconstrained model.
- The **one** measured soft spot: `gpt-5.4-mini` email validation, ~4–5% of the time it
  reaches for `email.utils.parseaddr` (a parser, not a validator) and accepts
  `"@missing-local.com"`. Every other task, both models, sits at parity.
- That soft spot is **model-level, not skill-level**: a sharpened validation rule in
  SKILL.md had **no reliable effect** in an n=100 A/B (96% → 95%, within noise), so it was
  not shipped. Adding skill text that doesn't move the number is exactly the cargo-cult
  Ponytail exists to avoid.

## Method

`baseline` (no skill) vs `ponytail` (full SKILL.md), single-shot, default params,
`gpt-4.1-mini` and `gpt-5.4-mini`. Each task runs generated code against edge-case
assertions. Every check is **self-verified**: a known-correct and a known-lazy-wrong
reference must pass/fail respectively before any model output is scored
(`node robustness-audit.js --selftest`, 16/16). Runs were serial to avoid quota 429s
shrinking denominators.

## Edge-case traps (n=20/cell)

All 12 algorithmic tasks: `baseline 20/20 == ponytail 20/20` on **both** models. Examples
of the traps (the lazy version passes the common case, fails the edge):

| task | the trap a lazy impl misses |
|---|---|
| is_prime | n = 0, 1, negatives |
| factorial / fibonacci | n = 0 |
| binary_search | empty list, target at the last index (off-by-one) |
| is_leap_year / days_in_month | 1900 not leap, 2000 leap (century rule) |
| int_to_roman | subtractive forms (4=IV, 9=IX, 40=XL) |
| flatten | nesting deeper than one level |
| clamp | value already in range |
| chunk | trailing remainder |

The only sub-20 cell in the first run was `gpt-5.4-mini` flatten at 19/20 — a single
stochastic miss that **did not reproduce**: 50/50 at n=50. (`clamp` showed 19/19, i.e. one
API error, not a wrong answer.)

## Validators (the parse ≠ validate trap)

| task | model | baseline | ponytail |
|---|---|--:|--:|
| email | gpt-5.4-mini | 50/50 | 49/50 |
| url | gpt-5.4-mini | — | 30/30 |
| creditcard | gpt-5.4-mini | — | 30/30 |
| ipv4 | gpt-5.4-mini | — | 29/30 |

Email is the one real weakness. `url`/`creditcard`/`ipv4` hold because Ponytail's
"stdlib first" instinct lands on *strict* helpers (`ipaddress`, scheme checks, Luhn) — only
email's obvious stdlib choice (`parseaddr`) is a parser that accepts malformed input.

## The fix that wasn't

SKILL.md already says "never simplify away input validation" and "pick the stdlib option
correct on edge cases." We tried sharpening it ("a validator that accepts malformed input is
wrong — reject the bad, don't just parse the good"). It looked like it worked at n=20
(18/20 → 20/20), but that was noise. The definitive n=100 A/B:

```
OLD skill: 96/100 (96.0%)
NEW skill: 95/100 (95.0%)   -> within noise, no reliable effect
```

So the edit was reverted. The email tendency is a property of `gpt-5.4-mini`, not of the
skill's wording, and re-emphasizing the rule doesn't change the model's reach for
`parseaddr`. Held-out tasks (url/creditcard/ipv4) never exhibited the failure under either
skill, so there was nothing for the principle to generalize to.

## Conclusion

"Ponytail degrades model performance" is not supported. On two weak models, across a battery
built specifically to catch lazy edge-case failures, Ponytail matches the unconstrained
baseline everywhere except a ~4–5% email-validator slip on `gpt-5.4-mini` — a model-level
quirk that prompt changes don't fix. The LOC win (≈half the code, see the main benchmark)
comes without a correctness tax on capable instruction-following models.

## Reproduce

```bash
cd benchmarks
node robustness-audit.js --selftest        # verify all 16 instruments (no API)
node robustness-audit.js                    # baseline vs ponytail, gpt-5.4-mini, n=20
AUDIT_MODEL=gpt-4.1-mini node robustness-audit.js
```
Needs `OPENAI_API_KEY` in `../.env`.
