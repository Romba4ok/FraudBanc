---
name: mvp-delivery
description: Deliver a small deployable MVP with a focused scope, minimal architecture, and verified readiness. Use when implementing or preparing a time-constrained application for handoff or deployment.
---

# MVP Delivery

Deliver the requested outcome as a working, understandable, and runnable MVP. Optimize for evidence of completion, not speculative production-scale design.

## Scope and implementation

- Implement the assigned requirement; do not add adjacent features without a concrete need.
- Prefer the smallest architecture and fewest dependencies that satisfy the known requirements.
- Make small, focused edits and avoid unrelated refactors or file changes.
- Keep configuration explicit and reproducible. Never put credentials or environment-specific secrets in source control.

## Verification

- Identify the observable behavior that proves the feature works.
- Run relevant tests after changes, investigate failures, and rerun the checks after fixing them.
- Confirm that the application can build and start with its documented configuration when the task affects delivery.
- Update documentation only when usage, setup, configuration, or behavior changed.

## Definition of done

Do not call the task complete until the implementation matches the request, relevant checks pass, and any required startup or main-flow verification has been performed. State what was verified and clearly name anything that could not be verified.

Use the existing focused skills for detailed testing, deployment readiness, or code review when those are the task's primary goal.
