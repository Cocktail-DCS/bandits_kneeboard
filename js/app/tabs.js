import { escapeHTML } from "../shared/html.js";
import { initNotesSaves } from "./notes.js";
import { getAtcPage, renderAtcPage } from "./renderers/atc.js";
import { buildArmamento } from "./renderers/loadouts.js";
import { getConfiguredPage, loadHtmlPage, renderConfiguredPage } from "./renderers/configured-pages.js";
import { getHolding, renderHolding } from "./renderers/holdings.js";
import { getTankerPage, renderTankerPage } from "./renderers/tankers.js";

export async function loadTab(tabId, event) {
    if (!tabId) return;

    if (event) {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        event.currentTarget.classList.add("active");
    }

    const container = document.getElementById("tab-content-container");
    container.innerHTML = "<p>Cargando información del waypoint...</p>";

    try {
        const atcPage = await getAtcPage(tabId);
        if (atcPage) {
            container.innerHTML = await renderAtcPage(atcPage);
            initNotesSaves();
            return;
        }

        const holding = await getHolding(tabId);
        if (holding) {
            container.innerHTML = renderHolding(holding);
            initNotesSaves();
            return;
        }

        const tankerPage = await getTankerPage(tabId);
        if (tankerPage) {
            container.innerHTML = renderTankerPage(tankerPage);
            initNotesSaves();
            return;
        }

        const configuredPage = await getConfiguredPage(tabId);
        if (configuredPage) {
            container.innerHTML = await renderConfiguredPage(configuredPage);
        } else {
            container.innerHTML = await loadHtmlPage(tabId);
        }

        initNotesSaves();
        await buildArmamento(tabId);
    } catch (error) {
        console.error("Error cargando la pestaña:", error);
        container.innerHTML = `<div class="error-panel">
            <h3>Error</h3>
            <p>No se encontró el archivo de este waypoint.</p>
            <small>${escapeHTML(error.message)}</small>
        </div>`;
    }
}
