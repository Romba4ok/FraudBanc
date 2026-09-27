---
name: testing
description: Run and analyze tests after implementing or modifying code.
---

# Testing Skill

## Goal

Verify that the implementation works correctly and detect regressions.

## Workflow

1. Inspect the project structure and identify the available test framework.
2. Identify tests relevant to the current changes.
3. Run the relevant tests.
4. Analyze failures instead of immediately changing the code.
5. Determine whether the failure is caused by:
   - the implementation;
   - the test;
   - the environment;
   - missing configuration.
6. Fix implementation issues when appropriate.
7. Run the tests again.
8. Report the final result.

## Rules

- Do not skip tests just because the implementation looks correct.
- Do not modify tests only to make them pass unless the test itself is incorrect.
- Prefer focused tests first, then run the broader test suite.
- Report failing tests clearly.
- Do not claim success without actually running the tests.