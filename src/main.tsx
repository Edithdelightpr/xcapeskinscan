import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/pwa/registerServiceWorker";

createRoot(document.getElementById("root")!).render(<App />);

// Guarded: no-ops (and cleans up) in dev, previews, iframes and ?sw=off.
void registerServiceWorker();
