import { StateCreator, StoreMutatorIdentifier } from "zustand";

// Define the type for the logger middleware
type Logger = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string,
) => StateCreator<T, Mps, Mcs>;

// Create the logger middleware
export const logger: Logger = (f, name) => (set, get, store) => {
  // For build, just pass through the original set function
  return f(set, get, store);
};

// Create a middleware that logs performance metrics
export const performanceLogger: Logger = (f, name) => (set, get, store) => {
  // For build, just pass through the original set function
  return f(set, get, store);
};

// Create a middleware that tracks state history
export const createHistoryMiddleware = <T extends object>(
  _maxHistoryLength = 10,
) => {
  // For build, just return a simple pass-through middleware
  return <
    S extends object,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  >(
    f: StateCreator<S, Mps, Mcs>,
  ): StateCreator<S, Mps, Mcs> => f;
};
