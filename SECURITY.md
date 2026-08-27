# Security Policy

ClassroomPanel is learning software used by children, and visitors' API keys transit the hosted service. Treat both facts as raising the stakes of any report.

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Instead, use GitHub's private reporting: [Report a vulnerability](https://github.com/rowant-labs/classroompanel/security/advisories/new). You'll get a private thread with the maintainer.

Please include the affected route or component, reproduction steps, and your assessment of impact — especially anything touching BYOK key handling (`lib/provider-keys.ts`, `lib/byok-client.ts`, the `/api/*` routes) or the learner record.

## What to expect

This is a solo-maintained project with AI-assisted triage. Reports get acknowledged as fast as humanly possible — please allow a reasonable window for a fix before public disclosure. Confirmed reporters get credited in the fix's release notes unless they prefer otherwise.

## Scope notes

- The hosted service stores nothing server-side; there are no accounts or databases to breach. The interesting surface is request handling: key forwarding, input sanitization on generation routes, and the board-image cache.
- Self-hosted instances are operated by whoever runs them; still, vulnerabilities in the code itself are absolutely in scope — report them here.
