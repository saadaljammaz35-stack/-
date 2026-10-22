// Tajawal is bundled with the app (no request to a font CDN, so no visitor IP leaves for one).
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "./index.css";
import "./zodConfig";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { NotConfigured } from "./components/layout/NotConfigured";
import { env } from "./env";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element in index.html");

createRoot(container).render(
  <StrictMode>
    {env.ok ? <App /> : <NotConfigured missing={[...env.missing, ...env.invalid]} />}
  </StrictMode>,
);
