"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";
const STANDALONE_QUERY = "(display-mode: standalone)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(STANDALONE_QUERY);
    const update = () => setIsStandalone(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isStandalone;
}

export function useDevice() {
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();
  return { isMobile, isStandalone };
}
