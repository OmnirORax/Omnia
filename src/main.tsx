import { installPageInputBoundary } from "./ui/pageInputBoundary";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";

installPageInputBoundary();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
