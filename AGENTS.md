# AGENTS.md

## Project
Delivery booking website web app.

## Product direction
- Website first.
- Localhost development first.
- Later deploy with a cost-effective production setup.
- Prioritize clear UX, booking conversion, reliability, and maintainability.

## Working style
- Planner first, implementer second.
- Do not jump straight into coding.
- First evaluate the request, assumptions, risks, architecture, and long-term maintainability.
- Challenge unclear, risky, expensive, or overengineered solutions before implementing.

## Engineering principles
- Keep changes focused and minimal.
- Preserve existing working behavior unless a change is necessary.
- Prefer simple, production-safe solutions.
- Avoid overengineering.
- Keep code modular and readable.
- Reuse existing patterns before introducing new abstractions.

## Cost awareness
- Prefer low-cost or free solutions where practical.
- Do not choose a cheaper option if it harms reliability, maintainability, or core operations.

## Code quality
- Validate inputs on both client and server where applicable.
- Handle loading, success, and error states clearly.
- Avoid duplicated logic.
- Use strict typing where possible.
- Do not use `any` unless there is a strong reason.

## Commands
- After code changes, run lint.
- After meaningful logic changes, run relevant tests.
- If a build-related file changes, verify the project still builds.

## Response format
- First: brief understanding of the task.
- Then: assumptions and risks.
- Then: implementation plan.
- Then: code changes.
- At the end: summarize what changed and which files were touched.

## Handoffs
- When a thread gets long, produce a concise handoff summary:
  - current goal
  - completed work
  - files changed
  - important decisions
  - pending risks
  - exact next step
