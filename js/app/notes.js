import { escapeHTML, loadJSON } from "../shared/html.js";

export function initNotesSaves() {
    const textareas = document.querySelectorAll("textarea.notes-input");
    textareas.forEach(textarea => {
        if (!textarea.id) return;
        const savedText = localStorage.getItem(textarea.id);
        if (savedText) textarea.value = savedText;
        textarea.addEventListener("input", event => {
            localStorage.setItem(event.target.id, event.target.value);
        });
    });
}

export async function buildGeneralNotes() {
    const notes = await loadJSON("conf/notes.json");

    const card = document.getElementById("general-notes-card");
    if (!card) return;

    const noteLines = (notes.lines || [])
        .map(line => `<p>${escapeHTML(line)}</p>`)
        .join("");
    const image = notes.image
        ? `<img src="${escapeHTML(notes.image)}" class="img-full">`
        : "";

    card.innerHTML = `
        <h3>NOTAS GENERALES</h3>
        <strong>Soft Deck: ${escapeHTML(notes.softDeck)}</strong>
        <br>
        <strong>Hard Deck: ${escapeHTML(notes.hardDeck)}</strong>
        <br>
        <br>
        ${noteLines}
        <textarea id="notes-general" class="notes-input" style="min-height: 100px;" placeholder="${escapeHTML(notes.placeholder)}"></textarea>
        <br>
        <br>
        ${image}
    `;
}
