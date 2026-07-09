# Photoshop Workbench PSD Fixtures

These PSD files are fixture assets for validating the MediaToolbox PSD
workbench backend with a real Photoshop runner.

Files:
- `smoke.psd`: small smoke-test template for quick backend checks.
- `baseline.psd`: larger baseline template for fuller scan/apply checks.

Suggested manual validation flow:
1. Configure `MEDIATOOLBOX_PHOTOSHOP_COMMAND` if auto-detection does not find
   Photoshop.
2. Run `npm run psd:roundtrip -- --fixture smoke --mode quick` for a fast
   scan/apply/scan/apply/scan smoke test.
3. Run `npm run psd:roundtrip -- --fixture baseline --mode full` after the
   smoke test passes and the required fonts are available.

The roundtrip command writes generated PSDs and `comparison.json` under
`.tmp/psd-roundtrip/` and never modifies these fixture files.
