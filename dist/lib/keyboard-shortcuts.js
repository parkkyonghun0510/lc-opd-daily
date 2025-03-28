import * as React from "react";
class KeyboardShortcutManager {
    constructor() {
        this.shortcuts = new Map();
        this.descriptions = new Map();
    }
    /**
     * Registers a keyboard shortcut
     */
    register(options, handler) {
        const key = this.getShortcutKey(options);
        this.shortcuts.set(key, handler);
        if (options.description) {
            this.descriptions.set(key, options.description);
        }
    }
    /**
     * Unregisters a keyboard shortcut
     */
    unregister(options) {
        const key = this.getShortcutKey(options);
        this.shortcuts.delete(key);
        this.descriptions.delete(key);
    }
    /**
     * Gets the description of a keyboard shortcut
     */
    getDescription(options) {
        const key = this.getShortcutKey(options);
        return this.descriptions.get(key);
    }
    /**
     * Gets all registered keyboard shortcuts
     */
    getAllShortcuts() {
        return Array.from(this.shortcuts.keys()).map((key) => ({
            key,
            description: this.descriptions.get(key),
        }));
    }
    /**
     * Generates a unique key for a keyboard shortcut
     */
    getShortcutKey(options) {
        const modifiers = [];
        if (options.ctrlKey)
            modifiers.push("Ctrl");
        if (options.shiftKey)
            modifiers.push("Shift");
        if (options.altKey)
            modifiers.push("Alt");
        if (options.metaKey)
            modifiers.push("Meta");
        modifiers.push(options.key.toUpperCase());
        return modifiers.join("+");
    }
    /**
     * Handles keyboard events
     */
    handleKeyDown(event) {
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
    window.addEventListener("keydown", (event) => keyboardShortcuts.handleKeyDown(event));
}
// Export a hook for using keyboard shortcuts in React components
export function useKeyboardShortcut(options, handler) {
    React.useEffect(() => {
        keyboardShortcuts.register(options, handler);
        return () => keyboardShortcuts.unregister(options);
    }, [
        options.key,
        options.ctrlKey,
        options.shiftKey,
        options.altKey,
        options.metaKey,
        handler,
    ]);
}
