---
name: code-review
description: Review implemented code for correctness, maintainability, security risks, and unnecessary complexity.
---

# Code Review Skill

## Goal

Review the current implementation after changes and identify problems before the code is considered ready.

## Workflow

1. Inspect the current project structure.
2. Inspect the changes and relevant surrounding code.
3. Understand the intended behavior before evaluating the implementation.
4. Check:
   - correctness;
   - error handling;
   - input validation;
   - security risks;
   - maintainability;
   - unnecessary complexity;
   - consistency with the existing project structure;
   - potential regressions.
5. Identify concrete findings.
6. Classify each finding by severity.
7. Suggest a practical improvement.
8. Do not modify files unless explicitly instructed.

## Rules

- Review the actual implementation, not assumptions.
- Do not invent problems that are not supported by the code.
- Prefer simple solutions appropriate for a small MVP.
- Do not recommend abstractions without a concrete reason.
- Distinguish confirmed problems from potential risks.
- Do not modify code during a review.
- Do not claim that something works without verifying it when verification is possible.

## Output

Return a concise review containing:

### Summary

Overall assessment of the implementation.

### Findings

For each finding:

- Severity: Critical / High / Medium / Low
- Location
- Problem
- Why it matters
- Suggested improvement

### Final verdict

Use one:

- PASS
- PASS WITH WARNINGS
- FAIL
- NOT REVIEWABLE