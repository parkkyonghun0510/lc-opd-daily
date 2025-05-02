import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    action: () => void;
    description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const matchingShortcut = shortcuts.find(
            shortcut =>
                event.key.toLowerCase() === shortcut.key.toLowerCase() &&
                !!shortcut.ctrl === event.ctrlKey &&
                !!shortcut.alt === event.altKey &&
                !!shortcut.shift === event.shiftKey
        );

        if (matchingShortcut) {
            event.preventDefault();
            matchingShortcut.action();
        }
    }, [shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // Return array of shortcut descriptions for help display
    const getShortcutDescriptions = () =>
        shortcuts.map(shortcut => {
            const keys = [];
            if (shortcut.ctrl) keys.push('Ctrl');
            if (shortcut.alt) keys.push('Alt');
            if (shortcut.shift) keys.push('Shift');
            keys.push(shortcut.key.toUpperCase());

            return {
                keys: keys.join('+'),
                description: shortcut.description
            };
        });

    return { getShortcutDescriptions };
}