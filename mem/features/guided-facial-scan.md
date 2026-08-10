---
name: Guided Facial Scan
description: Live-camera guided capture in the XCAPE New Analysis Images step — architecture, privacy and asset rules
type: feature
---

Guided Facial Scan is the primary capture mode in the New Analysis wizard Images step (`src/components/xcape/scan/`).

- Camera starts only after "Start scan" tap; front camera default; all tracks stopped on complete/cancel/unmount.
- MediaPipe `@mediapipe/tasks-vision` FaceLandmarker: WASM loaded from pinned jsdelivr CDN (must match installed npm version); model self-hosted at `public/models/face_landmarker.task` (repo rejects files >10MB, so never bundle the WASM).
- Landmarks used ONLY for alignment/head-yaw/auto-capture gates — never sent to any server. Only the 3 accepted stills (Front/Left/Right) are uploaded via the existing `useUploadClientMedia` private pipeline with captions "Guided facial scan — <view> view".
- Quality gates live in pure lib `src/lib/scan/scanQuality.ts` (single face, size, centering, yaw, brightness, Laplacian sharpness, 1.5s stable hold) — keep gates unit-tested, not in components.
- Manual upload remains as the fallback mode; scan requires 3 free media slots (max 4 per analysis).
