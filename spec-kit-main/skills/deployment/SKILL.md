---
name: deployment
description: Prepare, verify, and document deployment of the application.
---

# Deployment Skill

## Goal

Prepare the application for deployment and verify that it can be started reliably.

## Workflow

1. Inspect the project structure and determine how the application is built and started.
2. Identify required dependencies and environment variables.
3. Check that configuration does not contain hardcoded secrets.
4. Build the application.
5. Run relevant tests before deployment.
6. Prepare the required deployment configuration.
7. Start the application using the intended deployment configuration.
8. Verify that the application starts successfully.
9. Verify the main application functionality.
10. Document the deployment and required environment variables in the README.

## Rules

- Do not expose secrets or credentials.
- Do not hardcode environment-specific secrets.
- Do not claim that deployment succeeded without actually verifying it.
- Prefer the simplest deployment approach appropriate for the MVP.
- Do not introduce unnecessary infrastructure.
- Do not add Docker, CI/CD, orchestration, or cloud services unless they are actually required.
- Preserve reproducibility: another developer should be able to understand how to build and run the project.

## Output

Return a concise report containing:

### Build

Build result.

### Tests

Test result.

### Deployment

Deployment/startup result.

### Verification

What was verified.

### Configuration

Required environment variables and configuration.

### Issues

Any remaining deployment problems.

### Final verdict

Use one:

- READY
- READY WITH WARNINGS
- NOT READY