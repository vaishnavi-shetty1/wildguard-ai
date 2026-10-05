# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Inference providers

The dashboard can identify wildlife two ways. Both feed the same prediction
shape into notifications, the detection log and the bounding-box overlay, so
you can switch between them at runtime from the camera controls.

| Provider | Transport | Notes |
| --- | --- | --- |
| **Local YOLO** (default) | JPEG frame every 3s to `POST /api/v1/ai/predict` | Backend `yolo11n.pt`. Needs the FastAPI backend running. |
| **Roboflow** | WebRTC peer connection to a hosted Workflow | Annotated video comes back from Roboflow, so the local box overlay is hidden. SDK is loaded on demand. |

### Roboflow setup

Copy `.env.example` to `.env.local` and fill in the three required values:

```sh
cp .env.example .env.local
```

- `VITE_ROBOFLOW_API_KEY` — Roboflow API key
- `VITE_ROBOFLOW_WORKSPACE` — workspace slug
- `VITE_ROBOFLOW_WORKFLOW` — workflow ID

The rest of the vars in `.env.example` override the workflow input/output
names, plan and region; the defaults match a stock wildlife workflow. If
`VITE_ROBOFLOW_STREAM_OUTPUT` is set to an empty value the annotated
stream is auto-detected. When the required values are missing, the
Roboflow option is hidden and the dashboard stays on local inference.

**Key handling:** `VITE_*` values are inlined into the client bundle at
build time, so the key is visible to anyone who loads the dashboard. Give
it Workspace-scoped permissions only. To keep the key off the client, add
a backend that calls `initializeWebrtcWorker` and replace
`connectors.withApiKey(...)` with `connectors.withProxyUrl(<your endpoint>)`
in `src/utils/roboflowStream.js` — no other change is needed.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
