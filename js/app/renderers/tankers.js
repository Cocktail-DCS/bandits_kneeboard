import { escapeHTML, renderPageTitle } from "../../shared/html.js";
import { getTankerConfig } from "../data.js";

export async function getTankerPage(tabId) {
    if (tabId !== "3_tanker") return null;
    return getTankerConfig();
}

export function renderTankerPage(data) {
    const summary = (data.tankers || []).map(tanker => `
        <div class="card"><strong>${escapeHTML(tanker.callsign)}: ${escapeHTML(tanker.aircraft)}</strong></div>
    `).join("");

    const tankerCards = (data.tankers || []).map(tanker => `
        <div class="card">
            <div><strong>${escapeHTML(tanker.callsign)}</strong></div>
            <div class="data-grid">
                <div class="card"><strong>Rol:</strong> ${escapeHTML(tanker.role)}</div>
                <div class="card"><strong>Frecuencia:</strong> ${escapeHTML(tanker.freq)}</div>
                <div class="card"><strong>TCN:</strong> ${escapeHTML(tanker.tacan)}</div>
                <div class="card"><strong>Altitud:</strong> ${escapeHTML(tanker.altitude)}</div>
            </div>
        </div>
    `).join("");

    const notes = (data.notes || []).map(note => `
        <div class="card">
            <h3>${escapeHTML(note.title)}</h3>
            ${(note.text || []).map(line => `<p>${escapeHTML(line)}</p>`).join("")}
        </div>
    `).join("");

    return `
        ${renderPageTitle(data.title || "Repostaje")}
        <div class="card">
            <h3>SITUACIÓN</h3>
            <p>${escapeHTML(data.situation)}</p>
        </div>

        <div class="data-grid">${summary}</div>
        ${tankerCards}
        ${notes}
    `;
}
