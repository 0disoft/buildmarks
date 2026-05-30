# Real Profile README Smoke Test

This smoke test verifies that the released `0disoft/buildmarks@v0` Action works from a separate public profile README repository.

## Target Repository

The current v0 smoke target is:

```txt
0disoft/0disoft
```

The profile repository should contain the workflow at:

```txt
.github/workflows/update-buildmarks-card.yml
```

The workflow should generate and commit:

```txt
assets/buildmarks.svg
assets/buildmarks-report/buildmarks-report.html
assets/buildmarks-report/buildmarks-report.json
```

## Manual Verification

Run the workflow from GitHub Actions with `workflow_dispatch`, then confirm:

- the workflow uses `0disoft/buildmarks@v0`
- the workflow commits generated artifacts only when they change
- the profile README references `./assets/buildmarks.svg`
- the profile README links to `./assets/buildmarks-report/buildmarks-report.html`

This test is intentionally backend-free. GitHub serves the checked-in SVG and report files directly from the profile repository.
