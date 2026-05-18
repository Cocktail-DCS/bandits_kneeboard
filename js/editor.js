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

const EDITOR_IMAGE_FILES = [
    "images/Ruta.png",
    "images/airport_arrivals/andersen_ifr.jpeg",
    "images/airport_arrivals/incirlick_ifr.png",
    "images/airport_arrivals/incirlick_vfr.png",
    "images/airport_charts/andersen_airport_chart.png",
    "images/airport_charts/incirlick_airport_chart.png",
    "images/airport_departures/andersen_departure.jpeg",
    "images/airport_departures/incirlick_departures.png",
    "images/auth_codes.png",
    "images/auth_codes_silver_dust.jpg",
    "images/carrier/arrivals carrier español.png",
    "images/carrier/arrivals carrier ingles.png",
    "images/carrier/carrier_deck.png",
    "images/carrier/case1dep.png",
    "images/carrier/case1rec.png",
    "images/carrier/case2dep.png",
    "images/carrier/case2rec.png",
    "images/carrier/case3dep.png",
    "images/carrier/case3rec.png",
    "images/carrier/departures carrier español.png",
    "images/carrier/departures carrier ingles.png",
    "images/carrier/trim_despegue.png",
    "images/emblem.png",
    "images/eor.png",
];

const editorState = {
    enabled: false,
    conf: {},
    pages: {},
    htmlDocs: {},
    activeConfFile: EDITOR_CONF_FILES[0],
    activeHtmlFile: EDITOR_HTML_FILES[0],
    activeImageInput: null,
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
    const currentView = document.getElementById("editor-panel").dataset.view || "json";
    if (currentView === "json" && !saveActiveJson()) {
        return;
    }
    if (currentView === "html") syncVisualHtmlPage();

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

function rerenderHtmlEditorPreservingScroll() {
    const visualEditor = document.querySelector(".html-visual-editor");
    const imageList = document.querySelector(".editor-image-list");
    const scrollState = {
        visualTop: visualEditor?.scrollTop || 0,
        imageTop: imageList?.scrollTop || 0,
    };

    renderHtmlEditor();

    const nextVisualEditor = document.querySelector(".html-visual-editor");
    const nextImageList = document.querySelector(".editor-image-list");
    if (nextVisualEditor) nextVisualEditor.scrollTop = scrollState.visualTop;
    if (nextImageList) nextImageList.scrollTop = scrollState.imageTop;
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
            <aside class="editor-sidebar">
                <nav class="editor-file-list">
                    ${files.map(file => `
                        <button type="button" class="${file === editorState.activeHtmlFile ? "active" : ""}" data-html-file="${escapeHTML(file)}">
                            ${escapeHTML(file)}
                        </button>
                    `).join("")}
                </nav>
                ${renderEditorImageLibrary()}
            </aside>
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
                        <button type="button" class="editor-btn" data-html-preview>Preview</button>
                        <button type="button" class="editor-btn" data-html-sync>Actualizar HTML crudo</button>
                    </div>
                </div>
                <div class="html-visual-editor">
                    ${blocks.map(renderHtmlVisualBlock).join("")}
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
        syncVisualHtmlPage();
        editorState.activeHtmlFile = file;
        renderHtmlEditor();
    });

    enhanceHtmlVisualEditor(content);

    const updateFromVisualInput = event => {
        if (event.target.matches("textarea")) {
            event.target.textContent = event.target.value;
            autoResizeTextarea(event.target);
        }

        if (event.target.matches("[data-image-index]")) {
            const block = event.target.closest(".html-visual-block");
            const image = block?.querySelectorAll(".html-visual-content img")[Number(event.target.dataset.imageIndex)];
            if (image) image.setAttribute("src", event.target.value);
        }

        syncVisualHtmlPage();
        clearEditorMessage();
    };

    const visualEditor = content.querySelector(".html-visual-editor");
    visualEditor.addEventListener("input", updateFromVisualInput);
    visualEditor.addEventListener("change", updateFromVisualInput);
    visualEditor.addEventListener("focusin", event => {
        if (event.target.matches("[data-image-index]")) {
            editorState.activeImageInput = event.target;
        }
    });
    visualEditor.addEventListener("click", event => {
        const action = event.target.dataset.blockAction;
        if (!action) return;

        if (action === "remove-element") {
            removeVisualElement(event.target);
            syncVisualHtmlPage();
            rerenderHtmlEditorPreservingScroll();
            showEditorMessage("Elemento eliminado.");
            return;
        }

        if (action === "add-paragraph" || action === "add-list" || action === "add-list-item" || action === "add-checklist-item" || action === "add-image") {
            addElementToVisualBlock(event.target.closest(".html-visual-block"), action);
            rerenderHtmlEditorPreservingScroll();
            showEditorMessage("Elemento añadido.");
            return;
        }

        const index = Number(event.target.dataset.blockIndex);
        if (!Number.isInteger(index)) return;

        syncVisualHtmlPage();
        const currentBlocks = getEditableHtmlBlocks(editorState.htmlDocs[editorState.activeHtmlFile]);

        if (action === "delete") {
            deleteHtmlBlock(currentBlocks[index]);
            rerenderHtmlEditorPreservingScroll();
            showEditorMessage("Bloque eliminado.");
            return;
        }

        if (action === "move-up" || action === "move-down") {
            moveHtmlBlock(currentBlocks[index], action === "move-up" ? -1 : 1);
            rerenderHtmlEditorPreservingScroll();
            return;
        }
    });

    content.querySelector(".editor-image-library")?.addEventListener("click", event => {
        const imagePath = event.target.dataset.imagePath || event.target.closest("[data-image-path]")?.dataset.imagePath;
        if (!imagePath) return;
        useEditorImagePath(imagePath);
    });

    content.querySelector("[data-html-add-block]").addEventListener("click", () => {
        syncVisualHtmlPage();
        const type = content.querySelector("[data-new-block-type]").value;
        addHtmlBlock(type);
        rerenderHtmlEditorPreservingScroll();
        showEditorMessage("Bloque añadido.");
    });

    content.querySelector("[data-html-preview]").addEventListener("click", () => {
        syncVisualHtmlPage();
        openHtmlPreview();
    });

    content.querySelector("[data-html-sync]").addEventListener("click", () => {
        syncVisualHtmlPage();
        const raw = content.querySelector("#editor-html-raw");
        if (raw) raw.value = serializeHtmlDoc(editorState.htmlDocs[editorState.activeHtmlFile]);
        showEditorMessage("HTML crudo actualizado desde bloques.");
    });

    content.querySelector("[data-html-raw-apply]").addEventListener("click", () => {
        const raw = content.querySelector("#editor-html-raw").value;
        editorState.htmlDocs[editorState.activeHtmlFile] = parseHtmlFragment(raw);
        syncActiveHtmlPage();
        rerenderHtmlEditorPreservingScroll();
        showEditorMessage("HTML crudo aplicado.");
    });

    autoResizeTextareas(content);
}

function renderEditorImageLibrary() {
    return `
        <section class="editor-image-library">
            <header>
                <h4>Imágenes</h4>
                <small>Selecciona una ruta para usarla en un campo de imagen.</small>
            </header>
            <div class="editor-image-list">
                ${EDITOR_IMAGE_FILES.map(path => `
                    <button type="button" class="editor-image-item" data-image-path="${escapeHTML(path)}" title="${escapeHTML(path)}">
                        <img src="${escapeHTML(path)}" alt="">
                        <span>${escapeHTML(formatImageName(path))}</span>
                    </button>
                `).join("")}
            </div>
        </section>
    `;
}

function formatImageName(path) {
    return path.split("/").pop();
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

function renderHtmlVisualBlock(block) {
    const imageControls = Array.from(block.node.querySelectorAll?.("img") || []).map((image, index) => `
        <label class="html-visual-image-field">
            Imagen ${index + 1}
            <input type="text" value="${escapeHTML(image.getAttribute("src") || "")}" data-image-index="${index}">
        </label>
    `).join("");

    return `
        <article class="html-visual-block">
            <header class="html-visual-toolbar">
                <div>
                    <strong>${escapeHTML(HTML_BLOCK_TYPES[block.kind] || block.kind)} ${block.editorIndex + 1}</strong>
                    <small>${escapeHTML(block.node.tagName.toLowerCase())}</small>
                </div>
                <div class="html-insert-actions">
                    <button type="button" class="editor-btn editor-btn-compact" data-block-action="add-paragraph">Párrafo</button>
                    <button type="button" class="editor-btn editor-btn-compact" data-block-action="add-list">Lista</button>
                    <button type="button" class="editor-btn editor-btn-compact" data-block-action="add-list-item">Item</button>
                    <button type="button" class="editor-btn editor-btn-compact" data-block-action="add-checklist-item">Checklist</button>
                    <button type="button" class="editor-btn editor-btn-compact" data-block-action="add-image">Imagen</button>
                </div>
                <div class="html-block-actions">
                    <button type="button" class="editor-icon-btn" data-block-index="${block.editorIndex}" data-block-action="move-up" title="Subir">↑</button>
                    <button type="button" class="editor-icon-btn" data-block-index="${block.editorIndex}" data-block-action="move-down" title="Bajar">↓</button>
                    <button type="button" class="editor-icon-btn danger" data-block-index="${block.editorIndex}" data-block-action="delete" title="Eliminar">×</button>
                </div>
            </header>
            <div class="html-visual-content">${block.node.outerHTML}</div>
            ${imageControls ? `<div class="html-visual-image-fields">${imageControls}</div>` : ""}
        </article>
    `;
}

function enhanceHtmlVisualEditor(root) {
    root.querySelectorAll(".html-visual-content").forEach(content => {
        content.querySelectorAll(".html-element-delete").forEach(button => button.remove());

        content.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, small, figcaption").forEach(node => {
            node.setAttribute("contenteditable", "true");
            node.setAttribute("spellcheck", "false");
        });

        content.querySelectorAll(".notes-input:not(textarea)").forEach(node => {
            node.setAttribute("contenteditable", "true");
            node.setAttribute("spellcheck", "false");
        });

        addDeleteButtonsToVisualContent(content);
    });
}

function addDeleteButtonsToVisualContent(content) {
    const removableSelector = "p, li, img, textarea, figure, .notes-input:not(textarea)";
    content.querySelectorAll(removableSelector).forEach(element => {
        if (element.closest(".html-element-delete")) return;
        if (element.matches("input, button")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "html-element-delete";
        button.dataset.blockAction = "remove-element";
        button.title = "Eliminar elemento";
        button.textContent = "×";

        if (element.matches("li")) {
            element.insertBefore(button, element.firstChild);
            return;
        }

        element.parentNode.insertBefore(button, element);
    });
}

function removeVisualElement(button) {
    const listItem = button.closest("li");
    if (listItem && listItem.contains(button)) {
        const list = listItem.parentElement;
        listItem.remove();
        if (list?.matches("ul, ol") && !list.children.length) list.remove();
        return;
    }

    const target = button.nextElementSibling;
    if (target) {
        target.remove();
        button.remove();
        return;
    }

    button.remove();
}

function addElementToVisualBlock(block, action) {
    if (!block) return;

    const content = block.querySelector(".html-visual-content");
    const root = content?.firstElementChild;
    if (!content || !root) return;

    const target = root.classList?.contains("card") ? root : content;

    if (action === "add-paragraph") {
        const paragraph = document.createElement("p");
        paragraph.textContent = "Nuevo párrafo.";
        target.appendChild(paragraph);
    }

    if (action === "add-list") {
        const list = document.createElement("ul");
        const item = document.createElement("li");
        item.textContent = "Nuevo elemento.";
        list.appendChild(item);
        target.appendChild(list);
    }

    if (action === "add-list-item") {
        let list = target.querySelector("ul, ol");
        if (!list) {
            list = document.createElement("ul");
            target.appendChild(list);
        }
        const item = document.createElement("li");
        item.textContent = "Nuevo elemento.";
        list.appendChild(item);
    }

    if (action === "add-checklist-item") {
        let list = Array.from(target.querySelectorAll("ul, ol"))
            .find(candidate => candidate.querySelector('input[type="checkbox"]'));
        if (!list) {
            list = document.createElement("ul");
            target.appendChild(list);
        }

        const item = document.createElement("li");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        item.appendChild(checkbox);
        item.append(" Nuevo elemento.");
        list.appendChild(item);
    }

    if (action === "add-image") {
        const image = document.createElement("img");
        image.src = EDITOR_IMAGE_FILES[0] || "images/emblem.png";
        image.className = "img-full";
        target.appendChild(image);
    }

    enhanceHtmlVisualEditor(block);
    syncVisualHtmlPage();
}

function useEditorImagePath(imagePath) {
    const activeInput = editorState.activeImageInput?.isConnected ? editorState.activeImageInput : null;
    const targetInput = activeInput || document.querySelector(".html-visual-image-field input");

    if (targetInput) {
        targetInput.value = imagePath;
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        editorState.activeImageInput = targetInput;
        showEditorMessage(`Imagen asignada: ${imagePath}`);
        return;
    }

    copyTextToClipboard(imagePath);
}

function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        showEditorMessage(`Ruta de imagen: ${text}`);
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => showEditorMessage(`Ruta copiada: ${text}`))
        .catch(() => showEditorMessage(`Ruta de imagen: ${text}`));
}

function syncVisualHtmlPage() {
    const visualEditor = document.querySelector(".html-visual-editor");
    if (!visualEditor) return syncActiveHtmlPage();

    const html = Array.from(visualEditor.querySelectorAll(".html-visual-content"))
        .map(serializeVisualContent)
        .filter(Boolean)
        .join("\n\n");

    editorState.htmlDocs[editorState.activeHtmlFile] = parseHtmlFragment(html);
    syncActiveHtmlPage();
}

function serializeVisualContent(content) {
    const clone = content.cloneNode(true);
    cleanEditorMarkup(clone);
    return clone.innerHTML.trim();
}

function cleanEditorMarkup(root) {
    root.querySelectorAll(".html-element-delete").forEach(button => button.remove());

    root.querySelectorAll("[contenteditable]").forEach(node => {
        node.removeAttribute("contenteditable");
        node.removeAttribute("spellcheck");
    });

    root.querySelectorAll("textarea").forEach(textarea => {
        textarea.textContent = textarea.value;
        if (textarea.dataset.editorAutoHeight === "true") {
            textarea.style.height = "";
            textarea.removeAttribute("data-editor-auto-height");
        }
    });

    root.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        if (checkbox.checked) {
            checkbox.setAttribute("checked", "");
        } else {
            checkbox.removeAttribute("checked");
        }
    });
}

function autoResizeTextareas(root = document) {
    root.querySelectorAll("textarea").forEach(autoResizeTextarea);
}

function autoResizeTextarea(textarea) {
    textarea.dataset.editorAutoHeight = "true";
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
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

function openHtmlPreview() {
    closeHtmlPreview();

    const overlay = document.createElement("div");
    overlay.className = "editor-preview-overlay";
    overlay.innerHTML = `
        <section class="editor-preview-modal">
            <header>
                <h3>Preview: ${escapeHTML(editorState.activeHtmlFile)}</h3>
                <button type="button" class="editor-icon-btn" data-preview-close title="Cerrar">×</button>
            </header>
            <div class="editor-preview-content">${editorState.pages[editorState.activeHtmlFile] || ""}</div>
        </section>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
        if (event.target === overlay || event.target.dataset.previewClose != null) {
            closeHtmlPreview();
        }
    });
}

function closeHtmlPreview() {
    document.querySelector(".editor-preview-overlay")?.remove();
}

function exportSnapshot() {
    if (!saveActiveJson()) return;
    syncVisualHtmlPage();

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
