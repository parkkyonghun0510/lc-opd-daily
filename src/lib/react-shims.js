// This file provides shims for React features that might not be available in the current version
// but are required by some dependencies

// Shim for useEffectEvent which is used by @radix-ui/react-use-effect-event
// This is a simplified version that just wraps the callback function
export function useEffectEvent(callback) {
  return callback;
}

// Export the shim to be used by the patched modules
if (typeof window !== "undefined") {
  window.ReactShims = {
    useEffectEvent,
  };
}
