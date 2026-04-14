import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./index.css";

const AmbientBackground = () => (
  <>
    <div className="ambient">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
    </div>
    <div className="grid-overlay"></div>
  </>
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AmbientBackground />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);