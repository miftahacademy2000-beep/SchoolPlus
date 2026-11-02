import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

// Restore theme before first render to prevent flash
(() => {
  try {
    const stored = localStorage.getItem('app_user_settings');
    if (stored) {
      const { theme } = JSON.parse(stored);
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else if (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.classList.add('dark');
    }
  } catch {}
})();

createRoot(document.getElementById("root")!).render(<App />);
