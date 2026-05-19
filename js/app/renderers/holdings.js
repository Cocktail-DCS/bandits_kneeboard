import { escapeHTML, renderNotesBlock, renderPageTitle } from "../../shared/html.js";
import { appState } from "../state.js";
import { loadJSON } from "../../shared/html.js";

export async function getHolding(tabId) {
    if (!appState.holdingConfig) {
        appState.holdingConfig = await loadJSON("conf/holdings.json");
    }
    const item = appState.holdingConfig.items?.[tabId];
    if (!item) return null;

    return {
        ...appState.holdingConfig.defaults,
        ...item,
    };
}

export function renderHolding(data) {
    const procedureItems = (data.procedureIdeal || [])
        .map(item => `<li>${escapeHTML(item)}</li>`)
        .join("");

    const image = data.image
        ? `<img src="${escapeHTML(data.image)}" class="img-full">`
        : "";

    return `
        ${renderPageTitle(data.title || "Holding")}
        <div class="card">
            <h3>SITUACIÓN</h3>
            <p>${escapeHTML(data.situation)}</p>
        </div>

        <div class="card">
            <h3>RECUERDA</h3>
            <p><strong>JOKER:</strong> ${escapeHTML(data.joker)}</p>
            <p><strong>BINGO:</strong> ${escapeHTML(data.bingo)}</p>
        </div>

        <div class="card">
            <h3>LLEGADA</h3>
            ${renderNotesBlock(data.arrival)}
        </div>

        <div class="card">
            <h3>TOT</h3>
            <p>${escapeHTML(data.tot?.description || "")}</p>
            <h5>Push point: ${escapeHTML(data.tot?.pushPoint || "")}</h5>
        </div>

        <div class="card">
            <h3>Holdings</h3>
            <div class="data-grid">
                <div class="card"><strong>Punto de espera asignado: </strong>${escapeHTML(data.holding?.point || "")}</div>
                <div class="card"><strong>Altitud asignada: </strong>${escapeHTML(data.holding?.altitude || "")}</div>
            </div>
            ${image}
        </div>

        <div class="card">
            <h3>Procedimiento de espera Ideal</h3>
            <ul>${procedureItems}</ul>
        </div>

        <div class="card">
            <h3>IMPORTANTE:</h3>
            <p>${escapeHTML(data.important)}</p>
        </div>
    `;
}
