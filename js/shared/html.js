export async function loadJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    return res.json();
}

export function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function toLines(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

export function renderLines(lines) {
    return toLines(lines).map(line => escapeHTML(line)).join("<br>");
}

export function renderPageTitle(title) {
    return `
        <div class="page-header">
            <h2>${escapeHTML(title)}</h2>
        </div>
    `;
}

export function renderParagraphs(lines) {
    return toLines(lines).map(line => `<p>${escapeHTML(line)}</p>`).join("");
}

export function renderCard(title, content, className = "") {
    const classes = ["card", className].filter(Boolean).join(" ");
    return `
        <div class="${classes}">
            <h3>${escapeHTML(title)}</h3>
            ${content}
        </div>
    `;
}

export function renderNotesBlock(lines) {
    return `<div class="notes-input notes-display">${renderLines(lines)}</div>`;
}

export const COLOR_CLASS = {
    "orange": "bg-orange",
    "orange-dark": "bg-orange",
    "blue": "bg-blue",
    "blue-dark": "bg-blue",
    "purple": "bg-purple",
    "yellow": "bg-yellow",
    "green-light": "bg-green-light",
    "green": "bg-green-light",
    "red": "bg-red",
    "red-light": "bg-red-light",
    "black": "bg-black",
};
