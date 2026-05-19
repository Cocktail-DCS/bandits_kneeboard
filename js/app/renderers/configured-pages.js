import {
    escapeHTML,
    renderCard,
    renderNotesBlock,
    renderPageTitle,
    renderParagraphs,
} from "../../shared/html.js";
import { getPageConfig } from "../data.js";

export async function getConfiguredPage(tabId) {
    const config = await getPageConfig();
    const page = config.pages?.[tabId];
    if (!page) return null;

    const template = page.template ? config.templates?.[page.template] || {} : {};
    return {
        id: tabId,
        ...template,
        ...page,
    };
}

export async function renderConfiguredPage(page) {
    if (page.type === "html") return loadHtmlPage(page.html || page.id);
    if (page.type === "standard") return renderStandardPage(page);
    if (page.type === "operation") return renderOperationPage(page);
    return loadHtmlPage(page.id);
}

export async function loadHtmlPage(pageId) {
    const response = await fetch(`pages/${pageId}.html`);
    if (!response.ok) throw new Error(`No se pudo cargar ${pageId}.html`);
    return response.text();
}

function renderOperationPage(page) {
    return `
        ${renderPageTitle(page.title || "Operación")}
        ${renderCard("SITUACIÓN", `<p>${escapeHTML(page.situation || "")}</p>`)}
        ${renderFenceIn(page.fenceIn)}
        ${renderCard("IMPORTANTE", renderParagraphs(page.important || []))}
        <div class="card" id="armamento-placeholder"></div>
        ${renderObjectives(page.objectives)}
        ${renderCard("Regreso", `<p>${escapeHTML(page.return || "")}</p>`)}
    `;
}

function renderStandardPage(page) {
    const blocks = (page.blocks || []).map(renderPageBlock).join("");
    return `
        ${renderPageTitle(page.title || "Página")}
        ${blocks}
    `;
}

function renderPageBlock(block) {
    if (block.type === "notes") {
        return renderCard(block.title || "Notas", renderNotesBlock(block.lines || block.text || []));
    }

    if (block.type === "list" || block.type === "checklist") {
        const items = (block.items || []).map(item => {
            const checkbox = block.type === "checklist" ? '<input type="checkbox"> ' : "";
            return `<li>${checkbox}${escapeHTML(item)}</li>`;
        }).join("");
        return renderCard(block.title || "Lista", `<ul>${items}</ul>`);
    }

    if (block.type === "image") {
        const images = (block.images || [block]).filter(image => image.src);
        const content = images.map(image => `
            <figure class="image-figure">
                <img src="${escapeHTML(image.src)}" class="img-full${image.narrow ? " img-narrow" : ""}">
                ${image.caption ? `<figcaption>${escapeHTML(image.caption)}</figcaption>` : ""}
            </figure>
        `).join("");
        return renderCard(block.title || "Imagen", content);
    }

    if (block.type === "table") {
        const headers = (block.headers || []).map(header => `<th>${escapeHTML(header)}</th>`).join("");
        const rows = (block.rows || []).map(row => `
            <tr>${(row || []).map(cell => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>
        `).join("");
        return renderCard(block.title || "Tabla", `
            <table class="data-table">
                ${headers ? `<thead><tr>${headers}</tr></thead>` : ""}
                <tbody>${rows}</tbody>
            </table>
        `);
    }

    if (block.type === "textarea") {
        const minHeight = block.minHeight ? ` style="min-height: ${escapeHTML(block.minHeight)};"` : "";
        const id = block.id ? ` id="${escapeHTML(block.id)}"` : "";
        return renderCard(
            block.title || "Notas",
            `<textarea${id} class="notes-input"${minHeight} placeholder="${escapeHTML(block.placeholder || "")}"></textarea>`
        );
    }

    return renderCard(block.title || "Sección", renderParagraphs(block.lines || block.text || []));
}

function renderFenceIn(items) {
    if (!items?.length) return "";

    const list = items.map(item => `
        <li><strong>${escapeHTML(item.letter)}</strong>${escapeHTML(item.label ? ` ${item.label}:` : "")} ${escapeHTML(item.text || "")}</li>
    `).join("");

    return renderCard("FENCE-IN", `<ul>${list}</ul>`);
}

function renderObjectives(objectives) {
    if (!objectives) return "";

    const intro = renderParagraphs(objectives.intro || []);
    const items = (objectives.items || []).map(item => {
        const image = item.image
            ? `<img src="${escapeHTML(item.image)}" class="img-full">`
            : "";
        const details = (item.details || []).map(detail => `<p>${escapeHTML(detail)}</p>`).join("");

        return `
            <div class="card">
                <h4>${escapeHTML(item.title || "Objetivo")}</h4>
                ${image}
                ${details ? `<h5>Coordenadas</h5>${details}` : ""}
            </div>
        `;
    }).join("");

    return renderCard("Objetivos", `${intro}${items}`);
}
