import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

const MIN_LOADER_TIME = 600;
const loaderShownAt = performance.now();

function hideLoader() {
  const loader = document.getElementById("app-loader");
  if (!loader) return;

  const elapsed = performance.now() - loaderShownAt;
  const remaining = Math.max(0, MIN_LOADER_TIME - elapsed);

  window.setTimeout(() => {
    loader.classList.add("app-loader-hidden");
    loader.addEventListener("transitionend", () => loader.remove(), { once: true });
  }, remaining);
}

if (document.readyState === "complete") {
  hideLoader();
} else {
  window.addEventListener("load", hideLoader, { once: true });
}

// Fallback in case the 'load' event never fires (e.g. a stalled resource).
window.setTimeout(hideLoader, 3000);
