import { escapeHTML } from "../../shared/html.js";
import { getLoadouts } from "../data.js";

export async function buildArmamento(pageId) {
    const placeholder = document.getElementById("armamento-placeholder");
    if (!placeholder) return;

    try {
        const loadouts = await getLoadouts();
        const items = loadouts?.[pageId] || [];

        placeholder.innerHTML = "<h3>Armamento</h3>";
        if (!items.length) {
            placeholder.insertAdjacentHTML("beforeend", "<p>No hay armamento configurado para esta página.</p>");
            return;
        }

        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "card arma-item";
            div.innerHTML = renderLoadoutItem(item);
            placeholder.appendChild(div);
        });
    } catch (err) {
        console.error("Error cargando armamento:", err);
    }
}

export function renderLoadoutItem(item) {
    const brevity = item.brevity ? ` <span style="font-weight:normal">[${escapeHTML(item.brevity)}]</span>` : "";
    const nota = item.nota ? `: <span style="font-weight:normal">${escapeHTML(item.nota)}</span>` : "";
    return `<strong>${escapeHTML(item.cantidad)} ${escapeHTML(item.arma)}</strong>${brevity}${nota}`;
}
