import * as React from "react";

type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

interface KeyboardShortcutOptions {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description?: string;
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcutHandler> = new Map();
  private descriptions: Map<string, string> = new Map();

  /**
   * Registers a keyboard shortcut
   */
  register(
    options: KeyboardShortcutOptions,
    handler: KeyboardShortcutHandler,
  ): void {
    const key = this.getShortcutKey(options);
    this.shortcuts.set(key, handler);
    if (options.description) {
      this.descriptions.set(key, options.description);
    }
  }

  /**
   * Unregisters a keyboard shortcut
   */
  unregister(options: KeyboardShortcutOptions): void {
    const key = this.getShortcutKey(options);
    this.shortcuts.delete(key);
    this.descriptions.delete(key);
  }

  /**
   * Gets the description of a keyboard shortcut
   */
  getDescription(options: KeyboardShortcutOptions): string | undefined {
    const key = this.getShortcutKey(options);
    return this.descriptions.get(key);
  }

  /**
   * Gets all registered keyboard shortcuts
   */
  getAllShortcuts(): Array<{
    key: string;
    description?: string;
  }> {
    return Array.from(this.shortcuts.keys()).map((key) => ({
      key,
      description: this.descriptions.get(key),
    }));
  }

  /**
   * Generates a unique key for a keyboard shortcut
   */
  private getShortcutKey(options: KeyboardShortcutOptions): string {
    const modifiers = [];
    if (options.ctrlKey) modifiers.push("Ctrl");
    if (options.shiftKey) modifiers.push("Shift");
    if (options.altKey) modifiers.push("Alt");
    if (options.metaKey) modifiers.push("Meta");
    modifiers.push(options.key.toUpperCase());
    return modifiers.join("+");
  }

  /**
   * Handles keyboard events
   */
  handleKeyDown(event: KeyboardEvent): void {
    const key = this.getShortcutKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    });

    const handler = this.shortcuts.get(key);
    if (handler) {
      event.preventDefault();
      handler(event);
    }
  }
}

// Create a singleton instance
export const keyboardShortcuts = new KeyboardShortcutManager();

// Register global keyboard event listener
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) =>
    keyboardShortcuts.handleKeyDown(event),
  );
}

// Export a hook for using keyboard shortcuts in React components
export function useKeyboardShortcut(
  options: KeyboardShortcutOptions,
  handler: KeyboardShortcutHandler,
) {
  // Using a ref to store the options object to avoid dependency issues
  const optionsRef = React.useRef(options);

  // Update the ref when options change
  React.useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  React.useEffect(() => {
    const currentOptions = optionsRef.current;
    keyboardShortcuts.register(currentOptions, handler);
    return () => keyboardShortcuts.unregister(currentOptions);
  }, [handler]);
}
