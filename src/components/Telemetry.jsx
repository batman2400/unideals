import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initTelemetry, trackPageView } from "../lib/analytics";

function Telemetry() {
  const location = useLocation();

  useEffect(() => {
    initTelemetry();
  }, []);

  useEffect(() => {
    if (location.pathname === "/auth/callback") return;
    const path = `${location.pathname}${location.search}`;
    const timer = window.setTimeout(() => trackPageView(path), 50);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}

export default Telemetry;
