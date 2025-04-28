import { StateCreator, StoreMutatorIdentifier } from 'zustand';

// Define the type for the logger middleware
type Logger = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

// Create the logger middleware
export const logger: Logger = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...args) => {
    const isEnvironmentSupported = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';
    
    if (isEnvironmentSupported) {
      const previousState = get();
      const result = set(...args);
      const nextState = get();
      const storeName = name || 'store';
      const actionName = args[1]?.type || 'unknown';
      
      // Log state changes
      console.group(`%c${storeName}: %c${actionName}`, 'color: gray; font-weight: lighter;', 'color: black; font-weight: bold;');
      console.log('%cPrevious State:', 'color: #9E9E9E; font-weight: bold;', previousState);
      console.log('%cCurrent State:', 'color: #4CAF50; font-weight: bold;', nextState);
      console.log('%cAction:', 'color: #03A9F4; font-weight: bold;', args[0]);
      console.groupEnd();
      
      return result;
    }
    
    return set(...args);
  };
  
  return f(loggedSet, get, store);
};

// Create a middleware that logs performance metrics
export const performanceLogger: Logger = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...args) => {
    const isEnvironmentSupported = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';
    
    if (isEnvironmentSupported) {
      const storeName = name || 'store';
      const actionName = args[1]?.type || 'unknown';
      const startTime = performance.now();
      
      const result = set(...args);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log performance metrics
      console.log(`%c${storeName}: %c${actionName} took %c${duration.toFixed(2)}ms`, 
        'color: gray; font-weight: lighter;', 
        'color: black;', 
        `color: ${duration > 10 ? '#FF5722' : '#4CAF50'}; font-weight: bold;`
      );
      
      return result;
    }
    
    return set(...args);
  };
  
  return f(loggedSet, get, store);
};

// Create a middleware that tracks state history
export const createHistoryMiddleware = <T extends object>(maxHistoryLength = 10) => {
  type HistoryState<S> = {
    past: S[];
    present: S;
    future: S[];
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    reset: () => void;
  };
  
  const historyMiddleware = <
    S extends object,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = []
  >(
    f: StateCreator<S, Mps, Mcs>
  ): StateCreator<S & HistoryState<S>, Mps, Mcs> => (set, get, store) => {
    const initialState = f(
      (state, replace) => {
        const currentState = get() as S & HistoryState<S>;
        
        // Skip history tracking for undo/redo actions
        if (state._isUndoRedoAction) {
          return set(state, replace);
        }
        
        // Create a copy of the current state without history properties
        const presentState = { ...currentState };
        delete (presentState as any).past;
        delete (presentState as any).present;
        delete (presentState as any).future;
        delete (presentState as any).canUndo;
        delete (presentState as any).canRedo;
        delete (presentState as any).undo;
        delete (presentState as any).redo;
        delete (presentState as any).reset;
        
        // Update history
        const past = [...(currentState.past || []), presentState];
        if (past.length > maxHistoryLength) {
          past.shift(); // Remove oldest state if exceeding max length
        }
        
        return set(
          {
            ...state,
            past,
            present: { ...state },
            future: [],
            canUndo: past.length > 0,
            canRedo: false,
            _isUndoRedoAction: undefined,
          } as any,
          replace
        );
      },
      get,
      store
    );
    
    return {
      ...initialState,
      past: [],
      present: initialState,
      future: [],
      canUndo: false,
      canRedo: false,
      undo: () => {
        const state = get() as S & HistoryState<S>;
        if (!state.past.length) return;
        
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        
        set({
          ...previous,
          past: newPast,
          present: previous,
          future: [state.present, ...state.future],
          canUndo: newPast.length > 0,
          canRedo: true,
          _isUndoRedoAction: true,
        } as any);
      },
      redo: () => {
        const state = get() as S & HistoryState<S>;
        if (!state.future.length) return;
        
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        
        set({
          ...next,
          past: [...state.past, state.present],
          present: next,
          future: newFuture,
          canUndo: true,
          canRedo: newFuture.length > 0,
          _isUndoRedoAction: true,
        } as any);
      },
      reset: () => {
        set({
          ...initialState,
          past: [],
          present: initialState,
          future: [],
          canUndo: false,
          canRedo: false,
        } as any);
      },
    };
  };
  
  return historyMiddleware;
};
