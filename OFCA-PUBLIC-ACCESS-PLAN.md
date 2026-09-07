# OFCA release plan

## Target

Publish `@scramjet/ofca@0.1.0` as an experimental public npm package. The GitHub
repository may remain private; npm package visibility is independent.

## Already in place

- The publishable `dist/` artifact is allowlisted and checked by tests plus
  `npm run verify`.
- CI on `main` runs a clean install, lint, typecheck, tests, and package verification.
- GitHub Actions defaults to read-only permissions.
- The `production` GitHub environment is restricted to `main`.
- `.github/workflows/release.yml` is manual-only, requires explicit confirmation,
  verifies the artifact, requests an OIDC token, and rejects npm token variables.

## First publish

npm cannot configure a trusted publisher until a package already exists. Bootstrap the
first version once, then move immediately to OIDC.

1. Confirm the publisher can publish to the `@scramjet` npm scope and that
   `@scramjet/ofca` is available.
2. Confirm the exact `main` commit is green in CI and run:

   ```sh
   npm ci
   npm run verify
   ```

3. From a controlled terminal, publish the verified artifact with 2FA and a short-lived
   granular npm token:

   ```sh
   npm publish ./dist --access public
   ```

4. Verify the registry package with `npm view @scramjet/ofca@0.1.0` and a fresh install
   in a temporary consumer project.
5. Revoke the bootstrap token.

## Trusted publishing for later releases

After `0.1.0` exists, configure npm Trusted Publishing for:

- GitHub repository: `scramjetorg/ofca`
- workflow: `release.yml`
- environment: `production`

Subsequent releases use the manual GitHub Actions release workflow and OIDC; they do
not use a stored npm token.

## GitHub limitation

The current GitHub plan does not support branch protection or rulesets for this private
repository. CI, the `main`-only production environment, and deliberate manual release
dispatch are the current controls. Enable required CI branch protection if the plan or
repository visibility changes.
