import "./index.css";
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
