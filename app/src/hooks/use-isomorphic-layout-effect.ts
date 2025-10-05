import { useEffect, useLayoutEffect } from "react";

// Use useLayoutEffect in browser environments for immediate DOM updates
// and useEffect in SSR environments to avoid warnings
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
