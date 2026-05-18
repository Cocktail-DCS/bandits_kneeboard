const EDITOR_CONF_FILES = [
    "atc.json",
    "holdings.json",
    "loadouts.json",
    "notes.json",
    "packages.json",
    "pages.json",
    "radios.json",
    "tankers.json",
];

const EDITOR_HTML_FILES = [
    "1_startup_taxi_ground.html",
    "1_startup_taxi_carrier.html",
    "2_departures.html",
    "3_tanker.html",
    "8_arrivals_ground.html",
    "8_arrivals_carrier.html",
    "9_shutdown_taxi_ground.html",
    "9_shutdown_taxi_carrier.html",
];

const HTML_BLOCK_TYPES = {
    card: "Tarjeta",
    notes: "Comunicaciones",
    checklist: "Checklist",
    list: "Lista",
    image: "Imagen",
    textarea: "Notas editables",
    raw: "HTML crudo",
};

const editorState = {
    enabled: false,
    conf: {},
    pages: {},
    htmlDocs: {},
    activeConfFile: EDITOR_CONF_FILES[0],
    activeHtmlFile: EDITOR_HTML_FILES[0],
};

window.addEventListener("DOMContentLoaded", () => {
    if (!new URLSearchParams(window.location.search).has("edit")) return;
    editorState.enabled = true;
    document.body.classList.add("editor-mode");
    initEditor().catch(error => {
        console.error("Error iniciando editor:", error);
        showEditorError(error.message);
    });
});

async function initEditor() {
    mountEditorShell();
    await loadEditorSources();
    renderEditor();
}

function mountEditorShell() {
    const panel = document.createElement("section");
    panel.id = "editor-panel";
    panel.innerHTML = `
        <header class="editor-header">
            <div>
                <h2>Editor</h2>
                <small>Modo estático: exporta un snapshot para aplicarlo localmente.</small>
            </div>
            <div class="editor-actions">
                <button type="button" class="editor-btn" data-editor-action="reload">Recargar</button>
                <button type="button" class="editor-btn editor-btn-primary" data-editor-action="export">Exportar cambios</button>
            </div>
        </header>
        <div id="editor-message" class="editor-message" hidden></div>
        <div class="editor-tabs">
            <button type="button" class="editor-tab active" data-editor-view="json">JSON</button>
            <button type="button" class="editor-tab" data-editor-view="html">HTML</button>
        </div>
        <div id="editor-content"></div>
    `;
    document.body.appendChild(panel);

    panel.addEventListener("click", event => {
        const action = event.target.dataset.editorAction;
        if (action === "export") exportSnapshot();
        if (action === "reload") {
            loadEditorSources()
                .then(renderEditor)
                .then(() => showEditorMessage("Fuentes recargadas."))
                .catch(error => showEditorError(error.message));
        }

        const view = event.target.dataset.editorView;
        if (view) switchEditorView(view);
    });
}

async function loadEditorSources() {
    editorState.conf = {};
    editorState.pages = {};
    editorState.htmlDocs = {};

    await Promise.all(EDITOR_CONF_FILES.map(async file => {
        editorState.conf[file] = await loadJSON(`conf/${file}`);
    }));

    const htmlFiles = getEditorHtmlCandidates();
    await Promise.all(htmlFiles.map(async file => {
        const html = await loadOptionalText(`pages/${file}`);
        if (html == null) return;
        editorState.pages[file] = html;
        editorState.htmlDocs[file] = parseHtmlFragment(html);
    }));
}

function getEditorHtmlCandidates() {
    const packageTabs = (editorState.conf["packages.json"] || [])
        .flatMap(pkg => pkg.tabs || [])
        .map(tab => `${tab.id}.html`);
    return [...new Set([...EDITOR_HTML_FILES, ...packageTabs])];
}

async function loadOptionalText(url) {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.text();
}

function switchEditorView(view) {
    if ((document.getElementById("editor-panel").dataset.view || "json") === "json" && !saveActiveJson()) {
        return;
    }

    document.querySelectorAll(".editor-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.editorView === view);
    });
    document.getElementById("editor-panel").dataset.view = view;
    renderEditor();
}

function renderEditor() {
    const view = document.getElementById("editor-panel").dataset.view || "json";
    if (view === "html") {
        renderHtmlEditor();
        return;
    }
    renderJsonEditor();
}

function renderJsonEditor() {
    const content = document.getElementById("editor-content");
    content.innerHTML = `
        <div class="editor-layout">
            <nav class="editor-file-list">
                ${EDITOR_CONF_FILES.map(file => `
                    <button type="button" class="${file === editorState.activeConfFile ? "active" : ""}" data-conf-file="${escapeHTML(file)}">
                        ${escapeHTML(file)}
                    </button>
                `).join("")}
            </nav>
            <div class="editor-workspace">
                <div class="editor-workspace-header">
                    <h3>${escapeHTML(editorState.activeConfFile)}</h3>
                    <button type="button" class="editor-btn" data-json-validate>Validar JSON</button>
                </div>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(editorState.conf[editorState.activeConfFile]))}</textarea>
            </div>
        </div>
    `;

    content.querySelector(".editor-file-list").addEventListener("click", event => {
        const file = event.target.dataset.confFile;
        if (!file) return;
        if (!saveActiveJson()) return;
        editorState.activeConfFile = file;
        renderJsonEditor();
    });

    content.querySelector("[data-json-validate]").addEventListener("click", () => {
        if (saveActiveJson()) showEditorMessage(`${editorState.activeConfFile} es válido.`);
    });

    content.querySelector("#editor-json-textarea").addEventListener("input", () => {
        clearEditorMessage();
    });
}

function saveActiveJson() {
    const textarea = document.getElementById("editor-json-textarea");
    if (!textarea) return true;

    try {
        editorState.conf[editorState.activeConfFile] = JSON.parse(textarea.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en ${editorState.activeConfFile}: ${error.message}`);
        return false;
    }
}

function renderHtmlEditor() {
    const files = Object.keys(editorState.pages);
    if (!files.length) {
        document.getElementById("editor-content").innerHTML = "<p>No hay HTML personalizado disponible en pages/.</p>";
        return;
    }

    if (!editorState.pages[editorState.activeHtmlFile]) {
        editorState.activeHtmlFile = files[0];
    }

    const blocks = getEditableHtmlBlocks(editorState.htmlDocs[editorState.activeHtmlFile]);
    const content = document.getElementById("editor-content");
    content.innerHTML = `
        <div class="editor-layout">
            <nav class="editor-file-list">
                ${files.map(file => `
                    <button type="button" class="${file === editorState.activeHtmlFile ? "active" : ""}" data-html-file="${escapeHTML(file)}">
                        ${escapeHTML(file)}
                    </button>
                `).join("")}
            </nav>
            <div class="editor-workspace">
                <div class="editor-workspace-header">
                    <h3>${escapeHTML(editorState.activeHtmlFile)}</h3>
                    <div class="editor-actions">
                        <select class="editor-select" data-new-block-type>
                            ${Object.entries(HTML_BLOCK_TYPES).map(([value, label]) => `
                                <option value="${escapeHTML(value)}">${escapeHTML(label)}</option>
                            `).join("")}
                        </select>
                        <button type="button" class="editor-btn" data-html-add-block>Añadir bloque</button>
                        <button type="button" class="editor-btn" data-html-sync>Actualizar HTML crudo</button>
                    </div>
                </div>
                <div class="html-block-list">
                    ${blocks.map(renderHtmlBlockControl).join("")}
                </div>
                <details class="editor-advanced">
                    <summary>HTML crudo avanzado</summary>
                    <textarea id="editor-html-raw" class="editor-textarea" spellcheck="false">${escapeHTML(serializeHtmlDoc(editorState.htmlDocs[editorState.activeHtmlFile]))}</textarea>
                    <button type="button" class="editor-btn" data-html-raw-apply>Aplicar HTML crudo</button>
                </details>
            </div>
        </div>
    `;

    content.querySelector(".editor-file-list").addEventListener("click", event => {
        const file = event.target.dataset.htmlFile;
        if (!file) return;
        editorState.activeHtmlFile = file;
        renderHtmlEditor();
    });

    const updateFromBlockInput = event => {
        const index = Number(event.target.dataset.blockIndex);
        const field = event.target.dataset.blockField;
        if (!Number.isInteger(index) || !field) return;
        updateHtmlBlock(blocks[index], field, event.target.value);
        syncActiveHtmlPage();
        clearEditorMessage();
    };

    const blockList = content.querySelector(".html-block-list");
    blockList.addEventListener("input", updateFromBlockInput);
    blockList.addEventListener("change", updateFromBlockInput);
    blockList.addEventListener("click", event => {
        const action = event.target.dataset.blockAction;
        const index = Number(event.target.dataset.blockIndex);
        if (!action || !Number.isInteger(index)) return;

        if (action === "delete") {
            deleteHtmlBlock(blocks[index]);
            renderHtmlEditor();
            showEditorMessage("Bloque eliminado.");
            return;
        }

        if (action === "move-up" || action === "move-down") {
            moveHtmlBlock(blocks[index], action === "move-up" ? -1 : 1);
            renderHtmlEditor();
            return;
        }
    });

    content.querySelector("[data-html-add-block]").addEventListener("click", () => {
        const type = content.querySelector("[data-new-block-type]").value;
        addHtmlBlock(type);
        renderHtmlEditor();
        showEditorMessage("Bloque añadido.");
    });

    content.querySelector("[data-html-sync]").addEventListener("click", () => {
        const raw = content.querySelector("#editor-html-raw");
        if (raw) raw.value = serializeHtmlDoc(editorState.htmlDocs[editorState.activeHtmlFile]);
        showEditorMessage("HTML crudo actualizado desde bloques.");
    });

    content.querySelector("[data-html-raw-apply]").addEventListener("click", () => {
        const raw = content.querySelector("#editor-html-raw").value;
        editorState.htmlDocs[editorState.activeHtmlFile] = parseHtmlFragment(raw);
        syncActiveHtmlPage();
        renderHtmlEditor();
        showEditorMessage("HTML crudo aplicado.");
    });
}

function parseHtmlFragment(html) {
    const doc = document.implementation.createHTMLDocument("");
    doc.body.innerHTML = html;
    return doc;
}

function serializeHtmlDoc(doc) {
    return doc.body.innerHTML.trim();
}

function getEditableHtmlBlocks(doc) {
    return Array.from(doc.body.children).map((node, index) => {
        const heading = node.querySelector?.("h2, h3, h4, h5");
        const image = node.querySelector?.("img");
        const textarea = node.querySelector?.("textarea");
        const notes = node.classList?.contains("notes-input") ? node : node.querySelector?.(".notes-input");
        const list = node.querySelector?.("ul, ol");
        const forcedRaw = node.dataset?.editorKind === "raw";
        const rawOnly = forcedRaw || (!heading && !image && !textarea && !notes && !list && !node.querySelector?.("p, li, small"));

        return {
            editorIndex: index,
            node,
            kind: detectHtmlBlockKind(node, { notes, textarea, list, image, rawOnly }),
            heading,
            image,
            textarea,
            notes,
            list,
            rawOnly,
            textNodes: Array.from(node.querySelectorAll?.("p, li, small") || []),
        };
    });
}

function detectHtmlBlockKind(node, parts) {
    if (node.dataset?.editorKind === "raw") return "raw";
    if (parts.rawOnly) return "raw";
    if (parts.textarea) return "textarea";
    if (parts.notes) return "notes";
    if (parts.list) return "list";
    if (parts.image && !parts.heading) return "image";
    if (node.classList?.contains("card")) return "card";
    return node.tagName.toLowerCase();
}

function renderHtmlBlockControl(block) {
    const headingValue = block.heading ? block.heading.textContent : "";
    const textValue = block.textarea
        ? block.textarea.value
        : block.notes
            ? block.notes.innerHTML.replaceAll("<br>", "\n").replaceAll("<br />", "\n")
            : block.textNodes.map(node => node.textContent).join("\n");
    const imageValue = block.image ? block.image.getAttribute("src") || "" : "";
    const rawValue = block.kind === "raw" ? block.node.outerHTML : "";

    return `
        <article class="html-block">
            <header>
                <div>
                    <strong>${escapeHTML(HTML_BLOCK_TYPES[block.kind] || block.kind)} ${block.editorIndex + 1}</strong>
                    <small>${escapeHTML(block.node.tagName.toLowerCase())}</small>
                </div>
                <div class="html-block-actions">
                    <button type="button" class="editor-icon-btn" data-block-index="${block.editorIndex}" data-block-action="move-up" title="Subir">↑</button>
                    <button type="button" class="editor-icon-btn" data-block-index="${block.editorIndex}" data-block-action="move-down" title="Bajar">↓</button>
                    <button type="button" class="editor-icon-btn danger" data-block-index="${block.editorIndex}" data-block-action="delete" title="Eliminar">×</button>
                </div>
            </header>
            ${block.heading && block.kind !== "raw" ? `
                <label>
                    Título
                    <input type="text" value="${escapeHTML(headingValue)}" data-block-index="${block.editorIndex}" data-block-field="heading">
                </label>
            ` : ""}
            ${(block.textarea || block.notes || block.textNodes.length) && block.kind !== "raw" ? `
                <label>
                    Texto
                    <textarea class="editor-small-textarea" data-block-index="${block.editorIndex}" data-block-field="text">${escapeHTML(textValue)}</textarea>
                </label>
            ` : ""}
            ${block.image && block.kind !== "raw" ? `
                <label>
                    Imagen
                    <input type="text" value="${escapeHTML(imageValue)}" data-block-index="${block.editorIndex}" data-block-field="image">
                </label>
            ` : ""}
            ${block.kind === "raw" ? `
                <label>
                    HTML
                    <textarea class="editor-small-textarea" data-block-index="${block.editorIndex}" data-block-field="raw">${escapeHTML(rawValue)}</textarea>
                </label>
            ` : ""}
        </article>
    `;
}

function updateHtmlBlock(block, field, value) {
    if (field === "heading" && block.heading) {
        block.heading.textContent = value;
        return;
    }

    if (field === "image" && block.image) {
        block.image.setAttribute("src", value);
        return;
    }

    if (field === "raw") {
        replaceHtmlBlockWithRaw(block, value);
        block.node = editorState.htmlDocs[editorState.activeHtmlFile].body.children[block.editorIndex];
        return;
    }

    if (field !== "text") return;

    if (block.textarea) {
        block.textarea.value = value;
        block.textarea.textContent = value;
        return;
    }

    if (block.notes) {
        block.notes.innerHTML = value.split("\n").map(line => escapeHTML(line)).join("<br>");
        return;
    }

    const lines = value.split("\n");
    updateTextNodes(block, lines);
}

function replaceHtmlBlockWithRaw(block, value) {
    const doc = block.node.ownerDocument;
    const wrapper = doc.createElement("div");
    wrapper.innerHTML = value.trim();
    const replacement = wrapper.firstElementChild || doc.createTextNode(value);
    block.node.replaceWith(replacement);
}

function addHtmlBlock(type) {
    const doc = editorState.htmlDocs[editorState.activeHtmlFile];
    const block = createHtmlBlock(doc, type);
    doc.body.appendChild(block);
    syncActiveHtmlPage();
}

function createHtmlBlock(doc, type) {
    if (type === "notes") {
        return htmlToElement(doc, `
            <div class="card">
                <h3>Nueva comunicación</h3>
                <div class="notes-input" style="min-height: auto;">PILOTO: "..."<br>CONTROL: "..."</div>
            </div>
        `);
    }

    if (type === "checklist") {
        return htmlToElement(doc, `
            <div class="card">
                <h3>Nueva checklist</h3>
                <ul>
                    <li><input type="checkbox"> Primer punto</li>
                    <li><input type="checkbox"> Segundo punto</li>
                </ul>
            </div>
        `);
    }

    if (type === "list") {
        return htmlToElement(doc, `
            <div class="card">
                <h3>Nueva lista</h3>
                <ul>
                    <li>Primer punto</li>
                    <li>Segundo punto</li>
                </ul>
            </div>
        `);
    }

    if (type === "image") {
        return htmlToElement(doc, `
            <div class="card">
                <h3>Nueva imagen</h3>
                <img src="images/emblem.png" class="img-full">
            </div>
        `);
    }

    if (type === "textarea") {
        return htmlToElement(doc, `
            <div class="card">
                <h3>Nuevas notas</h3>
                <textarea id="notes-new-${Date.now()}" class="notes-input" placeholder="Escribe aqui tus notas."></textarea>
            </div>
        `);
    }

    if (type === "raw") {
        return htmlToElement(doc, `<div class="card" data-editor-kind="raw"><h3>HTML crudo</h3><p>Edita este bloque desde el campo HTML.</p></div>`);
    }

    return htmlToElement(doc, `
        <div class="card">
            <h3>Nueva sección</h3>
            <p>Contenido de la sección.</p>
        </div>
    `);
}

function htmlToElement(doc, html) {
    const wrapper = doc.createElement("div");
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}

function deleteHtmlBlock(block) {
    block.node.remove();
    syncActiveHtmlPage();
}

function moveHtmlBlock(block, direction) {
    const sibling = direction < 0 ? block.node.previousElementSibling : block.node.nextElementSibling;
    if (!sibling) return;

    if (direction < 0) {
        block.node.parentNode.insertBefore(block.node, sibling);
    } else {
        block.node.parentNode.insertBefore(sibling, block.node);
    }

    syncActiveHtmlPage();
}

function updateTextNodes(block, lines) {
    const existing = block.textNodes;

    existing.forEach((node, index) => {
        node.textContent = lines[index] || "";
    });

    if (lines.length <= existing.length) return;

    let anchor = existing[existing.length - 1] || block.heading;
    if (!anchor) return;

    lines.slice(existing.length).forEach(line => {
        const paragraph = block.node.ownerDocument.createElement("p");
        paragraph.textContent = line;
        anchor.parentNode.insertBefore(paragraph, anchor.nextSibling);
        block.textNodes.push(paragraph);
        anchor = paragraph;
    });
}

function syncActiveHtmlPage() {
    const doc = editorState.htmlDocs[editorState.activeHtmlFile];
    if (!doc) return;

    const html = serializeHtmlDoc(doc);
    editorState.pages[editorState.activeHtmlFile] = html;

    const raw = document.getElementById("editor-html-raw");
    if (raw) raw.value = html;
}

function exportSnapshot() {
    if (!saveActiveJson()) return;

    for (const [file, doc] of Object.entries(editorState.htmlDocs)) {
        editorState.pages[file] = serializeHtmlDoc(doc);
    }

    const snapshot = {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: "bandits-kneeboard-editor",
        conf: editorState.conf,
        pages: editorState.pages,
    };

    const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kneeboard-snapshot-${new Date().toISOString().slice(0, 19).replaceAll(":", "")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showEditorMessage("Snapshot exportado.");
}

function formatJSON(value) {
    return JSON.stringify(value, null, 2);
}

function showEditorMessage(message) {
    const box = document.getElementById("editor-message");
    box.hidden = false;
    box.className = "editor-message";
    box.textContent = message;
}

function showEditorError(message) {
    const box = document.getElementById("editor-message");
    if (!box) {
        alert(message);
        return;
    }
    box.hidden = false;
    box.className = "editor-message editor-message-error";
    box.textContent = message;
}

function clearEditorMessage() {
    const box = document.getElementById("editor-message");
    box.hidden = true;
    box.textContent = "";
}
