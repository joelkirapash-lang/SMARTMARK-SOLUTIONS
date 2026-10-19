import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/Toast";
import { ModeProvider } from "./context/Mode";
import { API_ORIGIN } from "./lib/api";
import "./index.css";

if (API_ORIGIN) { // open the connection to the server while the page is still loading
  const l = document.createElement("link");
  l.rel = "preconnect"; l.href = API_ORIGIN; l.crossOrigin = "";
  document.head.appendChild(l);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ModeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
