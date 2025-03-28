/**
 * Converts a hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}
/**
 * Converts RGB to relative luminance
 */
function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((val) => {
        const s = val / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
/**
 * Calculates the contrast ratio between two colors
 */
export function getContrastRatio(color1, color2) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2)
        return 0;
    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}
/**
 * Checks if the contrast ratio meets WCAG guidelines
 */
export function meetsContrastGuidelines(foreground, background, level = "AA") {
    const ratio = getContrastRatio(foreground, background);
    return level === "AA" ? ratio >= 4.5 : ratio >= 7;
}
/**
 * Adjusts a color to meet contrast guidelines
 */
export function adjustForContrast(foreground, background, level = "AA") {
    const rgb = hexToRgb(foreground);
    if (!rgb)
        return foreground;
    let { r, g, b } = rgb;
    let ratio = getContrastRatio(foreground, background);
    const targetRatio = level === "AA" ? 4.5 : 7;
    while (ratio < targetRatio && (r > 0 || g > 0 || b > 0)) {
        r = Math.max(0, r - 1);
        g = Math.max(0, g - 1);
        b = Math.max(0, b - 1);
        ratio = getContrastRatio(`#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`, background);
    }
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
