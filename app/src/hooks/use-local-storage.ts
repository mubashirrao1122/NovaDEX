import { useState } from "react";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

type StorageType = "localStorage" | "sessionStorage";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  type: StorageType = "localStorage"
): [T, (value: T) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // This effect runs only on the client side to prevent
  // errors with localStorage during server-side rendering
  useIsomorphicLayoutEffect(() => {
    try {
      // Get from local storage by key
      const storageObject = window[type];
      const item = storageObject.getItem(key);
      // Parse stored json or return initialValue if null
      setStoredValue(item ? JSON.parse(item) : initialValue);
    } catch (error) {
      // If error, return initialValue
      console.log(error);
      setStoredValue(initialValue);
    }
  }, [key, initialValue, type]);

  // Return a wrapped version of useState's setter function that 
  // persists the new value to localStorage
  const setValue = (value: T) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage (only in browser environments)
      if (typeof window !== "undefined") {
        const storageObject = window[type];
        storageObject.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.log(error);
    }
  };

  return [storedValue, setValue];
}
