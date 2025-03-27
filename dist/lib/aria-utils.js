/**
 * Generates a unique ID for an element
 */
export function generateId(prefix = "id") {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Creates ARIA attributes for a form field
 */
export function createFormFieldAriaProps(id, label, error, required) {
    return {
        id,
        "aria-label": label,
        "aria-describedby": error ? `${id}-error` : undefined,
        "aria-invalid": !!error,
        "aria-required": required,
    };
}
/**
 * Creates ARIA attributes for a form field error message
 */
export function createFormFieldErrorAriaProps(id) {
    return {
        id: `${id}-error`,
        role: "alert",
        "aria-live": "polite",
    };
}
/**
 * Creates ARIA attributes for a button
 */
export function createButtonAriaProps(label, pressed, expanded, controls) {
    return {
        "aria-label": label,
        "aria-pressed": pressed,
        "aria-expanded": expanded,
        "aria-controls": controls,
    };
}
/**
 * Creates ARIA attributes for a dialog
 */
export function createDialogAriaProps(id, title, description) {
    return {
        id,
        role: "dialog",
        "aria-labelledby": `${id}-title`,
        "aria-describedby": description ? `${id}-description` : undefined,
        "aria-modal": "true",
    };
}
/**
 * Creates ARIA attributes for a dialog title
 */
export function createDialogTitleAriaProps(id) {
    return {
        id: `${id}-title`,
        role: "heading",
        "aria-level": "2",
    };
}
/**
 * Creates ARIA attributes for a dialog description
 */
export function createDialogDescriptionAriaProps(id) {
    return {
        id: `${id}-description`,
        role: "status",
        "aria-live": "polite",
    };
}
/**
 * Creates ARIA attributes for a list
 */
export function createListAriaProps(id, label, type = "list") {
    return {
        id,
        role: type,
        "aria-label": label,
    };
}
/**
 * Creates ARIA attributes for a list item
 */
export function createListItemAriaProps(selected, expanded, controls) {
    return {
        role: "listitem",
        "aria-selected": selected,
        "aria-expanded": expanded,
        "aria-controls": controls,
    };
}
/**
 * Creates ARIA attributes for a tab
 */
export function createTabAriaProps(id, selected, controls) {
    return {
        id,
        role: "tab",
        "aria-selected": selected,
        "aria-controls": controls,
    };
}
/**
 * Creates ARIA attributes for a tab panel
 */
export function createTabPanelAriaProps(id, labelledBy, hidden) {
    return {
        id,
        role: "tabpanel",
        "aria-labelledby": labelledBy,
        "aria-hidden": hidden,
    };
}
