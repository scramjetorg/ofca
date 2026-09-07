# OFCA Public Access Readiness Plan

## Current position

OFCA is **not ready for public repository/npm release** and must remain private
until every blocker in this plan is completed and independently verified.

## Verified current facts

- Package development manifest is currently private.
- `dist/` packaging is sanitized/allowlisted and verified; no secrets or credentials
  were found in source, scripts, or tests.
- OFCA has no `.github` workflows, `SECURITY.md`, `CONTRIBUTING.md`, changelog,
  tags, release automation/configuration, or public-release provenance controls.
- `LICENSE` currently says `Copyright (c) 2026 Signicode`, while package metadata
  and repository references point to `Scramjet/scramjetorg`; the only commit author
  email in the repository is `cz@signicode.com`.
- The project version is `0.0.0`, explicitly labelled **Phase 0**, and the API is
  not frozen.
- Root `AGENTS.md` documents four submodules and stale gitlinks/uncommitted labels,
  while `.gitmodules` / workspace files include OFCA and root gitlinks were moved.

## Required blocker gates (in order)

### 1) Rights and publishing authorization

- [ ] Obtain a written authorization/assignment covering:
  - copyright holder confirmation,
  - Scramjet publication authority,
  - branding/trademark permission, including permitted use of project naming,
  - intended public author-email exposure policy,
  - npm `ofca` package name ownership and namespace control.

### 2) Rights alignment and legal/brand consistency

- [ ] Align `LICENSE`, package metadata, and repository branding with the authority
  confirmed in Gate 1.
- [ ] Remove or document/resolve mixed ownership signals so public-facing legal text
  and publisher identity are consistent.

### 3) Release model and API maturity decision

- [ ] Decide public API maturity/versioning policy and support windows.
- [ ] Decide whether repository visibility control (public/private) is independent of
  npm publishability.
- [ ] Publish decision memo that explicitly maps `0.0.0` / Phase 0 status to release
  restrictions and user expectations.

### 4) Governance documents and coordination metadata

- [ ] Add `SECURITY.md` with monitored contact and disclosure handling.
- [ ] Add `CONTRIBUTING.md` with expected contribution workflow.
- [ ] Add changelog/release notes area and governance process for updates.
- [ ] Repair root coordinator documents to reflect current OFCA ownership and active
  workflow status.

### 5) CI/CD quality and integrity controls

- [ ] Add CI for clean install.
- [ ] Add build/test/typecheck/lint/publish-verification steps.
- [ ] Add package verification (`npm pack --dry-run`) and artifact checks.
- [ ] Add dependency/security scanning in CI.

### 6) Infrastructure controls for release safety

- [ ] Configure branch/tag protections before any public visibility change.
- [ ] Configure least-privilege npm trusted publishing/provenance if publishing.
- [ ] Enforce policy that no durable npm tokens are stored in tracked files or any
  untrusted workflow context.

### 7) Pre-visibility / pre-publish sign-off

- [ ] Confirm organization and repository permissions and maintainer responsibilities.
- [ ] Review full author/git history and metadata consistency.
- [ ] Verify npm ownership, registry availability, and package namespace conflicts.
- [ ] Run clean-environment publish verification (dry run only unless authorized).
- [ ] Complete release/version/tag review against approved policy.

## Decision record

| Gate | Role owner | Required objective evidence |
| --- | --- | --- |
| 1. Rights and authorization | **Legal / rights owner** | Signed authorization artifacts naming copyright holder, publication authority, trademark permission, email policy, and npm namespace ownership. |
| 2. Alignment of legal metadata | **Maintainer / release owner** + **Legal / rights owner** | Updated/approved `LICENSE` and package metadata references; diff report proving no unresolved ownership mismatch remains. |
| 3. API maturity decision | **Maintainer / release owner** | Versioning policy document, API freeze statement, and visibility vs publish decision with acceptance criteria. |
| 4. Governance docs | **Maintainer / release owner** | Committed governance docs plus evidence of coordinator document correction and review timestamps. |
| 5. CI/CD controls | **Organization engineer / release owner** | CI workflow configuration and successful run logs for install/build/tests/typecheck/lint/pack/sast/security checks. |
| 6. Publication protections | **Organization administrator** + **Maintainer / release owner** | Branch/tag protection policy exports and npm trusted-publishing/provenance configuration review (no token material in repository). |
| 7. Pre-sign-off | **Organization administrator** + **Legal / rights owner** + **Maintainer / release owner** | Final checklists signed for permissions, history/metadata review, npm ownership availability, clean-environment verification, and version/tag approval. |

## Go / No-go criterion

**Go only if all gates above are complete and evidence-approved by all three roles.**

If any gate is incomplete or evidence is missing, the result is **No-go** and OFCA
must remain private.
