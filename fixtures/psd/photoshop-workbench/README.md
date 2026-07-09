# Photoshop Workbench PSD Fixtures

These PSD files are fixture assets for validating the MediaToolbox PSD
workbench backend with a real Photoshop runner.

Files:
- `smoke.psd`: small smoke-test template for quick backend checks.
- `baseline.psd`: larger baseline template for fuller scan/apply checks.

Suggested manual validation flow:
1. Copy the PSD files into the active workspace PSD directory, normally
   `.tmp/workspace/Workspace/PSD/`.
2. Configure `MEDIATOOLBOX_PHOTOSHOP_COMMAND` if auto-detection does not find
   Photoshop.
3. Start the local API and use `/api/psd/scan` with `/Workspace/PSD/smoke.psd`
   or `/Workspace/PSD/baseline.psd`.
