import { COLOR_CLASS, escapeHTML, loadJSON, toLines } from "./shared/html.js";
import {
    EDITOR_CONF_FILES,
    EDITOR_HTML_FILES,
    EDITOR_IMAGE_FILES,
    EDITOR_RADIO_COLOR_OPTIONS,
    HTML_BLOCK_TYPES,
    editorState,
} from "./editor/config.js";
import { renderEditorWiki } from "./editor/wiki.js";

window.addEventListener("DOMContentLoaded", () => {
    if (!new URLSearchParams(window.location.search).has("edit")) return;
    editorState.enabled = true;
    document.body.classList.add("editor-mode");
    setupEditorReturnLink();
    initEditor().catch(error => {
        console.error("Error iniciando editor:", error);
        showEditorError(error.message);
    });
});

function setupEditorReturnLink() {
    const link = document.getElementById("open-editor-link");
    if (!link) return;

    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.delete("edit");

    link.textContent = "Volver";
    link.title = "Volver a la pagina principal";
    link.href = targetUrl.href;
    link.addEventListener("click", event => {
        const confirmed = window.confirm("Se perderan los cambios no exportados del editor. ¿Quieres volver a la pagina principal?");
        if (!confirmed) event.preventDefault();
    });
}

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
            <button type="button" class="editor-tab" data-editor-view="wiki">Wiki</button>
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
    if (view === "wiki") {
        renderEditorWiki();
        return;
    }
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
    const isRadioEditor = editorState.activeConfFile === "radios.json";
    const isTankerEditor = editorState.activeConfFile === "tankers.json";
    const isLoadoutEditor = editorState.activeConfFile === "loadouts.json";
    const isHoldingEditor = editorState.activeConfFile === "holdings.json";
    const isNotesEditor = editorState.activeConfFile === "notes.json";
    const isAtcEditor = editorState.activeConfFile === "atc.json";
    const isPackagesEditor = editorState.activeConfFile === "packages.json";
    const isPagesEditor = editorState.activeConfFile === "pages.json";
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
                ${isRadioEditor ? renderRadioJsonEditor() : isTankerEditor ? renderTankerJsonEditor() : isLoadoutEditor ? renderLoadoutJsonEditor() : isHoldingEditor ? renderHoldingJsonEditor() : isNotesEditor ? renderNotesJsonEditor() : isAtcEditor ? renderAtcJsonEditor() : isPackagesEditor ? renderPackagesJsonEditor() : isPagesEditor ? renderPagesJsonEditor() : `
                    <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(editorState.conf[editorState.activeConfFile]))}</textarea>
                `}
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

    content.querySelector("#editor-json-textarea")?.addEventListener("input", () => {
        clearEditorMessage();
    });

    if (isRadioEditor) initRadioJsonEditor(content);
    if (isTankerEditor) initTankerJsonEditor(content);
    if (isLoadoutEditor) initLoadoutJsonEditor(content);
    if (isHoldingEditor) initHoldingJsonEditor(content);
    if (isNotesEditor) initNotesJsonEditor(content);
    if (isAtcEditor) initAtcJsonEditor(content);
    if (isPackagesEditor) initPackagesJsonEditor(content);
    if (isPagesEditor) initPagesJsonEditor(content);
}

function saveActiveJson() {
    if (editorState.activeConfFile === "radios.json" && document.querySelector(".radio-json-editor")) {
        return syncRadioJsonEditor();
    }
    if (editorState.activeConfFile === "tankers.json" && document.querySelector(".tanker-json-editor")) {
        return syncTankerJsonEditor();
    }
    if (editorState.activeConfFile === "loadouts.json" && document.querySelector(".loadout-json-editor")) {
        return syncLoadoutJsonEditor();
    }
    if (editorState.activeConfFile === "holdings.json" && document.querySelector(".holding-json-editor")) {
        return syncHoldingJsonEditor();
    }
    if (editorState.activeConfFile === "notes.json" && document.querySelector(".notes-json-editor")) {
        return syncNotesJsonEditor();
    }
    if (editorState.activeConfFile === "atc.json" && document.querySelector(".atc-json-editor")) {
        return syncAtcJsonEditor();
    }
    if (editorState.activeConfFile === "packages.json" && document.querySelector(".packages-json-editor")) {
        return syncPackagesJsonEditor();
    }
    if (editorState.activeConfFile === "pages.json" && document.querySelector(".pages-json-editor")) {
        return syncPagesJsonEditor();
    }

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

function renderRadioJsonEditor() {
    const config = editorState.conf["radios.json"] || { groups: [] };
    return `
        <div class="radio-json-editor">
            <div class="radio-json-table-wrap">
                <table class="radio-table radio-json-table">
                    <colgroup>
                        <col class="col-small"> <col class="col-large"> <col class="col-medium"> <col class="radio-json-color-col"> <col class="radio-json-action-col">
                        <col class="col-small"> <col class="col-large"> <col class="col-medium"> <col class="radio-json-color-col"> <col class="radio-json-action-col">
                    </colgroup>
                    <thead>
                        <tr><th colspan="10" class="header-green">RADIO COMMS</th></tr>
                        <tr class="bg-white">
                            ${renderRadioJsonGroupHeaders(config.groups?.[0], 0)}
                            ${renderRadioJsonGroupHeaders(config.groups?.[1], 1)}
                        </tr>
                    </thead>
                    <tbody class="bg-white">
                        ${renderRadioJsonRows(config.groups || [])}
                    </tbody>
                </table>
            </div>
            <div class="radio-json-actions">
                <button type="button" class="editor-btn" data-radio-add-row>
                    Añadir fila en ambas radios
                </button>
            </div>
            <details class="editor-advanced radio-json-raw">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function renderRadioJsonGroupHeaders(group = {}, groupIndex) {
    return `
        <th><input type="text" value="${escapeHTML(group.channelHeader || "")}" data-radio-header="${groupIndex}" data-radio-field="channelHeader"></th>
        <th><input type="text" value="${escapeHTML(group.agencyHeader || "")}" data-radio-header="${groupIndex}" data-radio-field="agencyHeader"></th>
        <th><input type="text" value="${escapeHTML(group.frequencyHeader || "")}" data-radio-header="${groupIndex}" data-radio-field="frequencyHeader"></th>
        <th>COLOR</th>
        <th></th>
    `;
}

function renderRadioJsonRows(groups) {
    const maxRows = Math.max(...groups.map(group => group.rows?.length || 0), 0);
    return Array.from({ length: maxRows }).map((_, rowIndex) => `
        <tr>
            ${renderRadioJsonRowCells(groups[0], 0, rowIndex)}
            ${renderRadioJsonRowCells(groups[1], 1, rowIndex)}
        </tr>
    `).join("");
}

function renderRadioJsonRowCells(group = {}, groupIndex, rowIndex) {
    const row = group.rows?.[rowIndex] || { radio: "", callsign: "", freq: "", color: "" };
    return `
        <td data-radio-row-anchor="${groupIndex}-${rowIndex}"><input type="text" value="${escapeHTML(row.radio)}" data-radio-group="${groupIndex}" data-radio-row="${rowIndex}" data-radio-field="radio"></td>
        <td class="${COLOR_CLASS[row.color] || ""}"><input type="text" value="${escapeHTML(row.callsign)}" data-radio-group="${groupIndex}" data-radio-row="${rowIndex}" data-radio-field="callsign"></td>
        <td><input type="text" value="${escapeHTML(row.freq)}" data-radio-group="${groupIndex}" data-radio-row="${rowIndex}" data-radio-field="freq"></td>
        <td>${renderRadioColorSelect(row.color, groupIndex, rowIndex)}</td>
        <td>
            <div class="radio-json-row-actions">
                <button type="button" class="editor-icon-btn" data-radio-move-row="${rowIndex}" data-radio-move-group="${groupIndex}" data-radio-move-direction="-1" title="Subir">↑</button>
                <button type="button" class="editor-icon-btn" data-radio-move-row="${rowIndex}" data-radio-move-group="${groupIndex}" data-radio-move-direction="1" title="Bajar">↓</button>
                <button type="button" class="editor-icon-btn danger" data-radio-delete-row="${rowIndex}" data-radio-delete-group="${groupIndex}" title="Eliminar fila">×</button>
            </div>
        </td>
    `;
}

function renderRadioColorSelect(selectedColor, groupIndex, rowIndex) {
    return `
        <select data-radio-group="${groupIndex}" data-radio-row="${rowIndex}" data-radio-field="color">
            ${EDITOR_RADIO_COLOR_OPTIONS.map(([value, label]) => `
                <option value="${escapeHTML(value)}"${value === selectedColor ? " selected" : ""}>${escapeHTML(label)}</option>
            `).join("")}
        </select>
    `;
}

function initRadioJsonEditor(content) {
    content.querySelector(".radio-json-editor").addEventListener("input", event => {
        updateRadioJsonField(event.target);
        clearEditorMessage();
    });

    content.querySelector(".radio-json-editor").addEventListener("change", event => {
        if (!event.target.dataset.radioField) return;
        updateRadioJsonField(event.target);
        if (event.target.dataset.radioField === "color") {
            renderJsonEditorPreservingRadioScroll();
        }
        clearEditorMessage();
    });

    content.querySelector(".radio-json-editor").addEventListener("click", event => {
        if (event.target.dataset.radioAddRow != null) {
            const rowIndex = addRadioJsonRow();
            renderJsonEditor();
            scrollToGenericElement(".radio-json-table-wrap", `[data-radio-row-anchor="0-${rowIndex}"]`);
            showEditorMessage("Fila añadida.");
            return;
        }

        const moveGroupIndex = event.target.dataset.radioMoveGroup;
        const moveRowIndex = event.target.dataset.radioMoveRow;
        const moveDirection = event.target.dataset.radioMoveDirection;
        if (moveGroupIndex != null && moveRowIndex != null && moveDirection != null) {
            const nextIndex = moveRadioJsonRow(Number(moveGroupIndex), Number(moveRowIndex), Number(moveDirection));
            renderJsonEditor();
            scrollToGenericElement(".radio-json-table-wrap", `[data-radio-row-anchor="${moveGroupIndex}-${nextIndex}"]`);
            return;
        }

        const deleteGroupIndex = event.target.dataset.radioDeleteGroup;
        const deleteRowIndex = event.target.dataset.radioDeleteRow;
        if (deleteGroupIndex != null && deleteRowIndex != null) {
            deleteRadioJsonRow(Number(deleteGroupIndex), Number(deleteRowIndex));
            renderJsonEditorPreservingRadioScroll();
            showEditorMessage("Fila eliminada.");
        }
    });
}

function updateRadioJsonField(target) {
    if (!target.dataset.radioField) return;

    const config = editorState.conf["radios.json"];
    const groupIndex = Number(target.dataset.radioGroup ?? target.dataset.radioHeader);
    const group = config.groups?.[groupIndex];
    if (!group) return;

    if (target.dataset.radioHeader != null) {
        group[target.dataset.radioField] = target.value;
        syncRadioJsonRawTextarea();
        return;
    }

    const rowIndex = Number(target.dataset.radioRow);
    if (!Number.isInteger(rowIndex)) return;
    group.rows ||= [];
    group.rows[rowIndex] ||= { radio: "", callsign: "", freq: "", color: "" };
    group.rows[rowIndex][target.dataset.radioField] = target.value;
    syncRadioJsonRawTextarea();
}

function addRadioJsonRow() {
    const groups = editorState.conf["radios.json"].groups || [];
    groups.forEach(group => {
        group.rows ||= [];
        group.rows.push({ radio: "", callsign: "", freq: "", color: "" });
    });
    syncRadioJsonRawTextarea();
    return Math.max(...groups.map(group => group.rows?.length || 0), 1) - 1;
}

function deleteRadioJsonRow(groupIndex, rowIndex) {
    const rows = editorState.conf["radios.json"].groups?.[groupIndex]?.rows;
    if (!rows?.[rowIndex]) return;
    rows.splice(rowIndex, 1);
    syncRadioJsonRawTextarea();
}

function moveRadioJsonRow(groupIndex, rowIndex, direction) {
    const rows = editorState.conf["radios.json"].groups?.[groupIndex]?.rows;
    if (!rows?.[rowIndex]) return rowIndex;

    const nextIndex = rowIndex + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) return rowIndex;

    const [row] = rows.splice(rowIndex, 1);
    rows.splice(nextIndex, 0, row);
    syncRadioJsonRawTextarea();
    return nextIndex;
}

function syncRadioJsonEditor() {
    const raw = document.getElementById("editor-json-textarea");
    if (!raw) return true;

    try {
        editorState.conf["radios.json"] = JSON.parse(raw.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en radios.json: ${error.message}`);
        return false;
    }
}

function syncRadioJsonRawTextarea() {
    const raw = document.getElementById("editor-json-textarea");
    if (raw) raw.value = formatJSON(editorState.conf["radios.json"]);
}

function renderJsonEditorPreservingRadioScroll() {
    const scrollable = document.querySelector(".radio-json-table-wrap");
    const scrollState = {
        top: scrollable?.scrollTop || 0,
        left: scrollable?.scrollLeft || 0,
    };

    renderJsonEditor();

    const nextScrollable = document.querySelector(".radio-json-table-wrap");
    if (nextScrollable) {
        nextScrollable.scrollTop = scrollState.top;
        nextScrollable.scrollLeft = scrollState.left;
    }
}

function renderTankerJsonEditor() {
    const config = editorState.conf["tankers.json"] || {};
    return `
        <div class="tanker-json-editor">
            <section class="editor-form-section">
                <label>
                    Título
                    <input type="text" value="${escapeHTML(config.title || "")}" data-tanker-field="title">
                </label>
                <label>
                    Situación
                    <textarea class="editor-small-textarea" data-tanker-field="situation">${escapeHTML(config.situation || "")}</textarea>
                </label>
            </section>

            <section class="editor-form-section">
                <div class="editor-section-header">
                    <h4>Tankers</h4>
                    <button type="button" class="editor-btn" data-tanker-add>Añadir tanker</button>
                </div>
                <div class="tanker-json-table-wrap">
                    <table class="data-table tanker-json-table">
                        <thead>
                            <tr>
                                <th>Callsign</th>
                                <th>Aeronave</th>
                                <th>Rol</th>
                                <th>Frecuencia</th>
                                <th>TACAN</th>
                                <th>Altitud</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(config.tankers || []).map(renderTankerJsonRow).join("")}
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="editor-form-section">
                <div class="editor-section-header">
                    <h4>Notas</h4>
                    <button type="button" class="editor-btn" data-note-add>Añadir nota</button>
                </div>
                <div class="tanker-note-list">
                    ${(config.notes || []).map(renderTankerNoteEditor).join("")}
                </div>
            </section>

            <details class="editor-advanced tanker-json-raw">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function renderTankerJsonRow(tanker, index) {
    const fields = ["callsign", "aircraft", "role", "freq", "tacan", "altitude"];
    return `
        <tr data-tanker-row-anchor="${index}">
            ${fields.map(field => `
                <td><input type="text" value="${escapeHTML(tanker[field] || "")}" data-tanker-index="${index}" data-tanker-row-field="${field}"></td>
            `).join("")}
            <td>
                <div class="radio-json-row-actions">
                    <button type="button" class="editor-icon-btn" data-tanker-move="${index}" data-tanker-direction="-1" title="Subir">↑</button>
                    <button type="button" class="editor-icon-btn" data-tanker-move="${index}" data-tanker-direction="1" title="Bajar">↓</button>
                    <button type="button" class="editor-icon-btn danger" data-tanker-delete="${index}" title="Eliminar">×</button>
                </div>
            </td>
        </tr>
    `;
}

function renderTankerNoteEditor(note, noteIndex) {
    return `
        <article class="tanker-note-editor" data-note-anchor="${noteIndex}">
            <header>
                <input type="text" value="${escapeHTML(note.title || "")}" data-note-index="${noteIndex}" data-note-field="title">
                <div class="radio-json-row-actions">
                    <button type="button" class="editor-icon-btn" data-note-move="${noteIndex}" data-note-direction="-1" title="Subir">↑</button>
                    <button type="button" class="editor-icon-btn" data-note-move="${noteIndex}" data-note-direction="1" title="Bajar">↓</button>
                    <button type="button" class="editor-icon-btn danger" data-note-delete="${noteIndex}" title="Eliminar">×</button>
                </div>
            </header>
            <div class="tanker-note-lines">
                ${(note.text || []).map((line, lineIndex) => `
                    <div class="tanker-note-line" data-note-line-anchor="${noteIndex}-${lineIndex}">
                        <textarea class="editor-small-textarea" data-note-index="${noteIndex}" data-note-line="${lineIndex}">${escapeHTML(line)}</textarea>
                        <button type="button" class="editor-icon-btn danger" data-note-index="${noteIndex}" data-note-line-delete="${lineIndex}" title="Eliminar línea">×</button>
                    </div>
                `).join("")}
            </div>
            <button type="button" class="editor-btn editor-btn-compact" data-note-index="${noteIndex}" data-note-line-add>Añadir párrafo</button>
        </article>
    `;
}

function initTankerJsonEditor(content) {
    const editor = content.querySelector(".tanker-json-editor");

    editor.addEventListener("input", event => {
        updateTankerJsonField(event.target);
        clearEditorMessage();
    });

    editor.addEventListener("click", event => {
        if (event.target.dataset.tankerAdd != null) {
            addTankerJsonTanker();
            const index = (editorState.conf["tankers.json"].tankers || []).length - 1;
            renderJsonEditor();
            scrollToGenericElement(".tanker-json-editor", `[data-tanker-row-anchor="${index}"]`);
            showEditorMessage("Tanker añadido.");
            return;
        }

        if (event.target.dataset.tankerDelete != null) {
            deleteTankerJsonTanker(Number(event.target.dataset.tankerDelete));
            renderJsonEditorPreservingTankerScroll();
            showEditorMessage("Tanker eliminado.");
            return;
        }

        if (event.target.dataset.tankerMove != null) {
            const nextIndex = moveArrayItem(editorState.conf["tankers.json"].tankers, Number(event.target.dataset.tankerMove), Number(event.target.dataset.tankerDirection));
            syncTankerJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".tanker-json-editor", `[data-tanker-row-anchor="${nextIndex}"]`);
            return;
        }

        if (event.target.dataset.noteAdd != null) {
            addTankerJsonNote();
            const index = (editorState.conf["tankers.json"].notes || []).length - 1;
            renderJsonEditor();
            scrollToGenericElement(".tanker-json-editor", `[data-note-anchor="${index}"]`);
            showEditorMessage("Nota añadida.");
            return;
        }

        if (event.target.dataset.noteDelete != null) {
            deleteTankerJsonNote(Number(event.target.dataset.noteDelete));
            renderJsonEditorPreservingTankerScroll();
            showEditorMessage("Nota eliminada.");
            return;
        }

        if (event.target.dataset.noteMove != null) {
            const nextIndex = moveArrayItem(editorState.conf["tankers.json"].notes, Number(event.target.dataset.noteMove), Number(event.target.dataset.noteDirection));
            syncTankerJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".tanker-json-editor", `[data-note-anchor="${nextIndex}"]`);
            return;
        }

        if (event.target.dataset.noteLineAdd != null) {
            addTankerJsonNoteLine(Number(event.target.dataset.noteIndex));
            const noteIndex = Number(event.target.dataset.noteIndex);
            const lineIndex = (editorState.conf["tankers.json"].notes?.[noteIndex]?.text || []).length - 1;
            renderJsonEditor();
            scrollToGenericElement(".tanker-json-editor", `[data-note-line-anchor="${noteIndex}-${lineIndex}"]`);
            showEditorMessage("Párrafo añadido.");
            return;
        }

        if (event.target.dataset.noteLineDelete != null) {
            deleteTankerJsonNoteLine(Number(event.target.dataset.noteIndex), Number(event.target.dataset.noteLineDelete));
            renderJsonEditorPreservingTankerScroll();
            showEditorMessage("Párrafo eliminado.");
        }
    });

    autoResizeTextareas(editor);
}

function updateTankerJsonField(target) {
    const config = editorState.conf["tankers.json"];

    if (target.dataset.tankerField) {
        config[target.dataset.tankerField] = target.value;
        syncTankerJsonRawTextarea();
        return;
    }

    if (target.dataset.tankerRowField) {
        const tanker = config.tankers?.[Number(target.dataset.tankerIndex)];
        if (!tanker) return;
        tanker[target.dataset.tankerRowField] = target.value;
        syncTankerJsonRawTextarea();
        return;
    }

    if (target.dataset.noteField === "title") {
        const note = config.notes?.[Number(target.dataset.noteIndex)];
        if (!note) return;
        note.title = target.value;
        syncTankerJsonRawTextarea();
        return;
    }

    if (target.dataset.noteLine != null) {
        const note = config.notes?.[Number(target.dataset.noteIndex)];
        if (!note) return;
        note.text ||= [];
        note.text[Number(target.dataset.noteLine)] = target.value;
        autoResizeTextarea(target);
        syncTankerJsonRawTextarea();
    }
}

function addTankerJsonTanker() {
    editorState.conf["tankers.json"].tankers ||= [];
    editorState.conf["tankers.json"].tankers.push({
        callsign: "NUEVO",
        aircraft: "",
        role: "",
        freq: "",
        tacan: "",
        altitude: "",
    });
    syncTankerJsonRawTextarea();
}

function deleteTankerJsonTanker(index) {
    editorState.conf["tankers.json"].tankers?.splice(index, 1);
    syncTankerJsonRawTextarea();
}

function addTankerJsonNote() {
    editorState.conf["tankers.json"].notes ||= [];
    editorState.conf["tankers.json"].notes.push({
        title: "Nueva nota",
        text: ["Nuevo párrafo."],
    });
    syncTankerJsonRawTextarea();
}

function deleteTankerJsonNote(index) {
    editorState.conf["tankers.json"].notes?.splice(index, 1);
    syncTankerJsonRawTextarea();
}

function addTankerJsonNoteLine(noteIndex) {
    const note = editorState.conf["tankers.json"].notes?.[noteIndex];
    if (!note) return;
    note.text ||= [];
    note.text.push("Nuevo párrafo.");
    syncTankerJsonRawTextarea();
}

function deleteTankerJsonNoteLine(noteIndex, lineIndex) {
    const lines = editorState.conf["tankers.json"].notes?.[noteIndex]?.text;
    if (!lines) return;
    lines.splice(lineIndex, 1);
    syncTankerJsonRawTextarea();
}

function moveArrayItem(items, index, direction) {
    if (!items?.[index]) return index;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return index;
    const [item] = items.splice(index, 1);
    items.splice(nextIndex, 0, item);
    return nextIndex;
}

function syncTankerJsonEditor() {
    const raw = document.getElementById("editor-json-textarea");
    if (!raw) return true;

    try {
        editorState.conf["tankers.json"] = JSON.parse(raw.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en tankers.json: ${error.message}`);
        return false;
    }
}

function syncTankerJsonRawTextarea() {
    const raw = document.getElementById("editor-json-textarea");
    if (raw) raw.value = formatJSON(editorState.conf["tankers.json"]);
}

function renderJsonEditorPreservingTankerScroll() {
    const tableWrap = document.querySelector(".tanker-json-table-wrap");
    const editor = document.querySelector(".tanker-json-editor");
    const scrollState = {
        tableTop: tableWrap?.scrollTop || 0,
        tableLeft: tableWrap?.scrollLeft || 0,
        editorTop: editor?.scrollTop || 0,
    };

    renderJsonEditor();

    const nextTableWrap = document.querySelector(".tanker-json-table-wrap");
    const nextEditor = document.querySelector(".tanker-json-editor");
    if (nextTableWrap) {
        nextTableWrap.scrollTop = scrollState.tableTop;
        nextTableWrap.scrollLeft = scrollState.tableLeft;
    }
    if (nextEditor) nextEditor.scrollTop = scrollState.editorTop;
}

function renderLoadoutJsonEditor() {
    const config = editorState.conf["loadouts.json"] || {};
    const loadoutIds = getLoadoutIds(config);
    const catalogItems = collectLoadoutCatalogItems(config);

    return `
        <div class="loadout-json-editor">
            <datalist id="loadout-weapon-options">
                ${catalogItems.map(item => `<option value="${escapeHTML(item.arma)}"></option>`).join("")}
            </datalist>
            <div class="editor-section-header">
                <h4>Loadouts</h4>
                <button type="button" class="editor-btn" data-loadout-add>Añadir loadout</button>
            </div>
            <div class="loadout-section-list">
                ${loadoutIds.map(id => renderLoadoutSection(id, config[id])).join("")}
            </div>
            ${renderLoadoutCatalog(config)}
            <details class="editor-advanced loadout-json-raw">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function getLoadoutIds(config) {
    return Object.keys(config).filter(key => Array.isArray(config[key]));
}

function renderLoadoutSection(id, items) {
    return `
        <section class="editor-form-section loadout-section" data-loadout-id="${escapeHTML(id)}">
            <div class="editor-section-header">
                <input type="text" value="${escapeHTML(id)}" data-loadout-rename="${escapeHTML(id)}">
                <div class="radio-json-row-actions">
                    <button type="button" class="editor-btn editor-btn-compact" data-loadout-item-add="${escapeHTML(id)}">Añadir arma</button>
                    <button type="button" class="editor-icon-btn" data-loadout-duplicate="${escapeHTML(id)}" title="Duplicar loadout">D</button>
                    <button type="button" class="editor-icon-btn danger" data-loadout-delete="${escapeHTML(id)}" title="Eliminar loadout">×</button>
                </div>
            </div>
            <div class="loadout-item-list">
                ${(items || []).map((item, index) => renderLoadoutItemEditor(id, item, index)).join("")}
            </div>
        </section>
    `;
}

function renderLoadoutItemEditor(loadoutId, item, index) {
    return `
        <article class="loadout-item-editor">
            <input type="text" value="${escapeHTML(item.cantidad || "")}" data-loadout-id="${escapeHTML(loadoutId)}" data-loadout-index="${index}" data-loadout-field="cantidad" placeholder="x1">
            <input type="text" value="${escapeHTML(item.arma || "")}" data-loadout-id="${escapeHTML(loadoutId)}" data-loadout-index="${index}" data-loadout-field="arma" list="loadout-weapon-options" placeholder="Arma">
            <input type="text" value="${escapeHTML(item.brevity || "")}" data-loadout-id="${escapeHTML(loadoutId)}" data-loadout-index="${index}" data-loadout-field="brevity" placeholder="Brevity">
            <textarea class="editor-small-textarea" data-loadout-id="${escapeHTML(loadoutId)}" data-loadout-index="${index}" data-loadout-field="nota" placeholder="Nota">${escapeHTML(item.nota || "")}</textarea>
            <div class="radio-json-row-actions">
                <button type="button" class="editor-icon-btn" data-loadout-item-move="${escapeHTML(loadoutId)}" data-loadout-index="${index}" data-loadout-direction="-1" title="Subir">↑</button>
                <button type="button" class="editor-icon-btn" data-loadout-item-move="${escapeHTML(loadoutId)}" data-loadout-index="${index}" data-loadout-direction="1" title="Bajar">↓</button>
                <button type="button" class="editor-icon-btn danger" data-loadout-item-delete="${escapeHTML(loadoutId)}" data-loadout-index="${index}" title="Eliminar">×</button>
            </div>
        </article>
    `;
}

function renderLoadoutCatalog(config) {
    const catalogItems = collectLoadoutCatalogItems(config);
    if (!catalogItems.length) return "";

    return `
        <details class="editor-advanced loadout-catalog">
            <summary>Catálogo de armamento (${catalogItems.length})</summary>
            <div class="loadout-catalog-list">
                ${catalogItems.map(item => `
                    <button type="button" class="loadout-catalog-item" data-catalog-weapon="${escapeHTML(item.arma)}">
                        <strong>${escapeHTML(item.arma)}</strong>
                        <span>${escapeHTML(item.brevity || "N/A")}</span>
                        <small>${escapeHTML(item.nota || "")}</small>
                    </button>
                `).join("")}
            </div>
        </details>
    `;
}

function collectLoadoutCatalogItems(config) {
    const help = config?._help || {};
    const itemsByWeapon = new Map();

    ["f16", "f18"].forEach(aircraftKey => {
        const aircraft = help[aircraftKey] || {};
        Object.entries(aircraft).forEach(([key, value]) => {
            if (key === "aeronave" || !Array.isArray(value)) return;
            value.forEach(item => {
                if (!item?.arma || itemsByWeapon.has(item.arma)) return;
                itemsByWeapon.set(item.arma, item);
            });
        });
    });

    return [...itemsByWeapon.values()].sort((a, b) => a.arma.localeCompare(b.arma));
}

function initLoadoutJsonEditor(content) {
    const editor = content.querySelector(".loadout-json-editor");

    editor.addEventListener("input", event => {
        updateLoadoutJsonField(event.target);
        clearEditorMessage();
    });

    editor.addEventListener("change", event => {
        if (event.target.dataset.loadoutRename) {
            renameLoadoutJsonSection(event.target.dataset.loadoutRename, event.target.value);
            syncLoadoutJsonRawTextarea();
            renderJsonEditorPreservingLoadoutScroll();
            return;
        }

        if (event.target.dataset.loadoutField === "arma") {
            applyCatalogWeaponToLoadoutItem(event.target);
            renderJsonEditorPreservingLoadoutScroll();
        }
    });

    editor.addEventListener("click", event => {
        const catalogWeapon = event.target.dataset.catalogWeapon || event.target.closest("[data-catalog-weapon]")?.dataset.catalogWeapon;
        if (catalogWeapon) {
            const result = addCatalogWeaponToFirstLoadout(catalogWeapon);
            renderJsonEditor();
            if (result) {
                scrollToLoadoutElement(`[data-loadout-id="${cssEscape(result.id)}"] [data-loadout-index="${result.index}"]`);
            }
            showEditorMessage("Arma añadida desde catálogo.");
            return;
        }

        if (event.target.dataset.loadoutAdd != null) {
            const id = addLoadoutJsonSection();
            renderJsonEditor();
            scrollToLoadoutElement(`[data-loadout-id="${cssEscape(id)}"]`);
            showEditorMessage("Loadout añadido.");
            return;
        }

        if (event.target.dataset.loadoutDelete != null) {
            deleteLoadoutJsonSection(event.target.dataset.loadoutDelete);
            renderJsonEditorPreservingLoadoutScroll();
            showEditorMessage("Loadout eliminado.");
            return;
        }

        if (event.target.dataset.loadoutDuplicate != null) {
            const id = duplicateLoadoutJsonSection(event.target.dataset.loadoutDuplicate);
            renderJsonEditor();
            scrollToLoadoutElement(`[data-loadout-id="${cssEscape(id)}"]`);
            showEditorMessage("Loadout duplicado.");
            return;
        }

        if (event.target.dataset.loadoutItemAdd) {
            const id = event.target.dataset.loadoutItemAdd;
            const index = addLoadoutJsonItem(id);
            renderJsonEditor();
            scrollToLoadoutElement(`[data-loadout-id="${cssEscape(id)}"] [data-loadout-index="${index}"]`);
            showEditorMessage("Arma añadida.");
            return;
        }

        if (event.target.dataset.loadoutItemDelete) {
            deleteLoadoutJsonItem(event.target.dataset.loadoutItemDelete, Number(event.target.dataset.loadoutIndex));
            renderJsonEditorPreservingLoadoutScroll();
            showEditorMessage("Arma eliminada.");
            return;
        }

        if (event.target.dataset.loadoutItemMove) {
            const id = event.target.dataset.loadoutItemMove;
            const nextIndex = moveArrayItem(editorState.conf["loadouts.json"][id], Number(event.target.dataset.loadoutIndex), Number(event.target.dataset.loadoutDirection));
            syncLoadoutJsonRawTextarea();
            renderJsonEditor();
            scrollToLoadoutElement(`[data-loadout-id="${cssEscape(id)}"] [data-loadout-index="${nextIndex}"]`);
        }
    });

    autoResizeTextareas(editor);
}

function updateLoadoutJsonField(target) {
    const config = editorState.conf["loadouts.json"];

    if (target.dataset.loadoutRename) {
        return;
    }

    if (!target.dataset.loadoutField) return;
    const item = config[target.dataset.loadoutId]?.[Number(target.dataset.loadoutIndex)];
    if (!item) return;
    item[target.dataset.loadoutField] = target.value;
    if (target.matches("textarea")) autoResizeTextarea(target);
    syncLoadoutJsonRawTextarea();
}

function applyCatalogWeaponToLoadoutItem(target) {
    const item = editorState.conf["loadouts.json"][target.dataset.loadoutId]?.[Number(target.dataset.loadoutIndex)];
    const catalogItem = findLoadoutCatalogItem(target.value);
    if (!item || !catalogItem) return;
    item.arma = catalogItem.arma;
    if (!item.brevity && catalogItem.brevity) item.brevity = catalogItem.brevity;
    if (!item.nota && catalogItem.nota) item.nota = catalogItem.nota;
    syncLoadoutJsonRawTextarea();
}

function findLoadoutCatalogItem(weaponName) {
    return collectLoadoutCatalogItems(editorState.conf["loadouts.json"]).find(item => item.arma === weaponName);
}

function addLoadoutJsonSection() {
    const config = editorState.conf["loadouts.json"];
    let index = getLoadoutIds(config).length + 1;
    let id = `op_nuevo${index}`;
    while (config[id]) {
        index += 1;
        id = `op_nuevo${index}`;
    }
    config[id] = [];
    syncLoadoutJsonRawTextarea();
    return id;
}

function renameLoadoutJsonSection(oldId, newId) {
    const config = editorState.conf["loadouts.json"];
    const cleanId = String(newId || "").trim();
    if (!cleanId || cleanId === oldId || config[cleanId]) return;
    const reordered = {};
    Object.entries(config).forEach(([key, value]) => {
        reordered[key === oldId ? cleanId : key] = value;
    });
    editorState.conf["loadouts.json"] = reordered;
}

function deleteLoadoutJsonSection(id) {
    delete editorState.conf["loadouts.json"][id];
    syncLoadoutJsonRawTextarea();
}

function duplicateLoadoutJsonSection(id) {
    const config = editorState.conf["loadouts.json"];
    const nextId = makeUniqueId(id, config);
    const reordered = {};
    Object.entries(config).forEach(([key, value]) => {
        reordered[key] = value;
        if (key === id) reordered[nextId] = cloneJSON(value);
    });
    editorState.conf["loadouts.json"] = reordered;
    syncLoadoutJsonRawTextarea();
    return nextId;
}

function addLoadoutJsonItem(id, item = { cantidad: "x1", arma: "", brevity: "", nota: "" }) {
    editorState.conf["loadouts.json"][id] ||= [];
    editorState.conf["loadouts.json"][id].push(item);
    syncLoadoutJsonRawTextarea();
    return editorState.conf["loadouts.json"][id].length - 1;
}

function deleteLoadoutJsonItem(id, index) {
    editorState.conf["loadouts.json"][id]?.splice(index, 1);
    syncLoadoutJsonRawTextarea();
}

function addCatalogWeaponToFirstLoadout(weaponName) {
    const firstId = getLoadoutIds(editorState.conf["loadouts.json"])[0];
    if (!firstId) return null;
    const catalogItem = findLoadoutCatalogItem(weaponName);
    const index = addLoadoutJsonItem(firstId, {
        cantidad: "x1",
        arma: catalogItem?.arma || weaponName,
        brevity: catalogItem?.brevity || "",
        nota: catalogItem?.nota || "",
    });
    return { id: firstId, index };
}

function syncLoadoutJsonEditor() {
    const raw = document.getElementById("editor-json-textarea");
    if (!raw) return true;

    try {
        editorState.conf["loadouts.json"] = JSON.parse(raw.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en loadouts.json: ${error.message}`);
        return false;
    }
}

function syncLoadoutJsonRawTextarea() {
    const raw = document.getElementById("editor-json-textarea");
    if (raw) raw.value = formatJSON(editorState.conf["loadouts.json"]);
}

function renderJsonEditorPreservingLoadoutScroll() {
    const editor = document.querySelector(".loadout-json-editor");
    const scrollTop = editor?.scrollTop || 0;
    renderJsonEditor();
    const nextEditor = document.querySelector(".loadout-json-editor");
    if (nextEditor) nextEditor.scrollTop = scrollTop;
}

function renderHoldingJsonEditor() {
    const config = editorState.conf["holdings.json"] || {};
    const defaults = config.defaults || {};
    const itemIds = getHoldingItemIds(config);

    return `
        <div class="holding-json-editor">
            <section class="editor-form-section">
                <div class="editor-section-header">
                    <h4>Contenido común de la página</h4>
                </div>
                <label>
                    Título
                    <input type="text" value="${escapeHTML(defaults.title || "")}" data-holding-default-field="title">
                </label>
                <label>
                    Situación
                    <textarea class="editor-small-textarea" data-holding-default-field="situation">${escapeHTML(defaults.situation || "")}</textarea>
                </label>
                <label>
                    Llegada / comunicaciones
                    <textarea class="editor-small-textarea" data-holding-default-list="arrival">${escapeHTML((defaults.arrival || []).join("\n"))}</textarea>
                </label>
                <label>
                    Procedimiento ideal
                    <textarea class="editor-small-textarea" data-holding-default-list="procedureIdeal">${escapeHTML((defaults.procedureIdeal || []).join("\n"))}</textarea>
                </label>
                <label>
                    Importante
                    <textarea class="editor-small-textarea" data-holding-default-field="important">${escapeHTML(defaults.important || "")}</textarea>
                </label>
                <div class="editor-two-col">
                    <label>
                        TOT
                        <input type="text" value="${escapeHTML(defaults.tot?.description || "")}" data-holding-default-tot="description">
                    </label>
                    <label>
                        Push point
                        <input type="text" value="${escapeHTML(defaults.tot?.pushPoint || "")}" data-holding-default-tot="pushPoint">
                    </label>
                </div>
            </section>

            <section class="editor-form-section">
                <div class="editor-section-header">
                    <h4>Holdings por vuelo</h4>
                    <button type="button" class="editor-btn" data-holding-add>Añadir holding</button>
                </div>
                <div class="holding-item-list">
                    ${itemIds.map(id => renderHoldingItemEditor(id, config.items[id])).join("")}
                </div>
            </section>

            <details class="editor-advanced holding-json-raw">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function getHoldingItemIds(config) {
    return Object.keys(config.items || {});
}

function renderHoldingItemEditor(id, item = {}) {
    return `
        <article class="holding-item-editor" data-holding-id="${escapeHTML(id)}">
            <header>
                <input type="text" value="${escapeHTML(id)}" data-holding-rename="${escapeHTML(id)}">
                <div class="radio-json-row-actions">
                    <button type="button" class="editor-icon-btn" data-holding-move="${escapeHTML(id)}" data-holding-direction="-1" title="Subir">↑</button>
                    <button type="button" class="editor-icon-btn" data-holding-move="${escapeHTML(id)}" data-holding-direction="1" title="Bajar">↓</button>
                    <button type="button" class="editor-icon-btn" data-holding-duplicate="${escapeHTML(id)}" title="Duplicar holding">D</button>
                    <button type="button" class="editor-icon-btn danger" data-holding-delete="${escapeHTML(id)}" title="Eliminar">×</button>
                </div>
            </header>
            <div class="editor-two-col">
                <label>
                    Joker
                    <input type="text" value="${escapeHTML(item.joker || "")}" data-holding-id="${escapeHTML(id)}" data-holding-field="joker">
                </label>
                <label>
                    Bingo
                    <input type="text" value="${escapeHTML(item.bingo || "")}" data-holding-id="${escapeHTML(id)}" data-holding-field="bingo">
                </label>
                <label>
                    Punto
                    <input type="text" value="${escapeHTML(item.holding?.point || "")}" data-holding-id="${escapeHTML(id)}" data-holding-nested="holding" data-holding-field="point">
                </label>
                <label>
                    Altitud
                    <input type="text" value="${escapeHTML(item.holding?.altitude || "")}" data-holding-id="${escapeHTML(id)}" data-holding-nested="holding" data-holding-field="altitude">
                </label>
                <label>
                    Imagen
                    <input type="text" value="${escapeHTML(item.image || "")}" data-holding-id="${escapeHTML(id)}" data-holding-field="image">
                </label>
            </div>
            <details>
                <summary>Overrides de página para este vuelo</summary>
                <label>
                    Título propio
                    <input type="text" value="${escapeHTML(item.title || "")}" data-holding-id="${escapeHTML(id)}" data-holding-field="title">
                </label>
                <label>
                    Situación propia
                    <textarea class="editor-small-textarea" data-holding-id="${escapeHTML(id)}" data-holding-field="situation">${escapeHTML(item.situation || "")}</textarea>
                </label>
                <label>
                    Llegada propia
                    <textarea class="editor-small-textarea" data-holding-id="${escapeHTML(id)}" data-holding-list="arrival">${escapeHTML((item.arrival || []).join("\n"))}</textarea>
                </label>
                <label>
                    Procedimiento propio
                    <textarea class="editor-small-textarea" data-holding-id="${escapeHTML(id)}" data-holding-list="procedureIdeal">${escapeHTML((item.procedureIdeal || []).join("\n"))}</textarea>
                </label>
                <label>
                    Importante propio
                    <textarea class="editor-small-textarea" data-holding-id="${escapeHTML(id)}" data-holding-field="important">${escapeHTML(item.important || "")}</textarea>
                </label>
                <div class="editor-two-col">
                    <label>
                        TOT propio
                        <input type="text" value="${escapeHTML(item.tot?.description || "")}" data-holding-id="${escapeHTML(id)}" data-holding-nested="tot" data-holding-field="description">
                    </label>
                    <label>
                        Push point propio
                        <input type="text" value="${escapeHTML(item.tot?.pushPoint || "")}" data-holding-id="${escapeHTML(id)}" data-holding-nested="tot" data-holding-field="pushPoint">
                    </label>
                </div>
            </details>
        </article>
    `;
}

function initHoldingJsonEditor(content) {
    const editor = content.querySelector(".holding-json-editor");

    editor.addEventListener("input", event => {
        updateHoldingJsonField(event.target);
        clearEditorMessage();
    });

    editor.addEventListener("change", event => {
        if (event.target.dataset.holdingRename) {
            const id = renameHoldingJsonItem(event.target.dataset.holdingRename, event.target.value);
            syncHoldingJsonRawTextarea();
            renderJsonEditorPreservingHoldingScroll();
            if (id) scrollToHoldingElement(`[data-holding-id="${cssEscape(id)}"]`);
        }
    });

    editor.addEventListener("click", event => {
        if (event.target.dataset.holdingAdd != null) {
            const id = addHoldingJsonItem();
            renderJsonEditor();
            scrollToHoldingElement(`[data-holding-id="${cssEscape(id)}"]`);
            showEditorMessage("Holding añadido.");
            return;
        }

        if (event.target.dataset.holdingDelete) {
            deleteHoldingJsonItem(event.target.dataset.holdingDelete);
            renderJsonEditorPreservingHoldingScroll();
            showEditorMessage("Holding eliminado.");
            return;
        }

        if (event.target.dataset.holdingDuplicate) {
            const id = duplicateHoldingJsonItem(event.target.dataset.holdingDuplicate);
            renderJsonEditor();
            scrollToHoldingElement(`[data-holding-id="${cssEscape(id)}"]`);
            showEditorMessage("Holding duplicado.");
            return;
        }

        if (event.target.dataset.holdingMove) {
            const id = moveHoldingJsonItem(event.target.dataset.holdingMove, Number(event.target.dataset.holdingDirection));
            renderJsonEditor();
            scrollToHoldingElement(`[data-holding-id="${cssEscape(id)}"]`);
        }
    });

    autoResizeTextareas(editor);
}

function updateHoldingJsonField(target) {
    const config = editorState.conf["holdings.json"];

    if (target.dataset.holdingRename) return;

    if (target.dataset.holdingDefaultField) {
        config.defaults ||= {};
        config.defaults[target.dataset.holdingDefaultField] = target.value;
        if (target.matches("textarea")) autoResizeTextarea(target);
        syncHoldingJsonRawTextarea();
        return;
    }

    if (target.dataset.holdingDefaultList) {
        config.defaults ||= {};
        config.defaults[target.dataset.holdingDefaultList] = splitTextareaLines(target.value);
        autoResizeTextarea(target);
        syncHoldingJsonRawTextarea();
        return;
    }

    if (target.dataset.holdingDefaultTot) {
        config.defaults ||= {};
        config.defaults.tot ||= {};
        config.defaults.tot[target.dataset.holdingDefaultTot] = target.value;
        syncHoldingJsonRawTextarea();
        return;
    }

    const id = target.dataset.holdingId;
    if (!id) return;
    config.items ||= {};
    config.items[id] ||= {};
    const item = config.items[id];

    if (target.dataset.holdingList) {
        item[target.dataset.holdingList] = splitTextareaLines(target.value);
        autoResizeTextarea(target);
        syncHoldingJsonRawTextarea();
        return;
    }

    if (target.dataset.holdingNested) {
        item[target.dataset.holdingNested] ||= {};
        item[target.dataset.holdingNested][target.dataset.holdingField] = target.value;
        syncHoldingJsonRawTextarea();
        return;
    }

    if (target.dataset.holdingField) {
        item[target.dataset.holdingField] = target.value;
        if (target.matches("textarea")) autoResizeTextarea(target);
        syncHoldingJsonRawTextarea();
    }
}

function splitTextareaLines(value) {
    return String(value).split("\n");
}

function addHoldingJsonItem() {
    const config = editorState.conf["holdings.json"];
    config.items ||= {};
    let index = getHoldingItemIds(config).length + 1;
    let id = `holding_push_nuevo${index}`;
    while (config.items[id]) {
        index += 1;
        id = `holding_push_nuevo${index}`;
    }
    config.items[id] = {
        joker: "",
        bingo: "",
        holding: { point: "", altitude: "" },
    };
    syncHoldingJsonRawTextarea();
    return id;
}

function deleteHoldingJsonItem(id) {
    delete editorState.conf["holdings.json"].items?.[id];
    syncHoldingJsonRawTextarea();
}

function duplicateHoldingJsonItem(id) {
    const config = editorState.conf["holdings.json"];
    config.items ||= {};
    const nextId = makeUniqueId(id, config.items);
    const reordered = {};
    Object.entries(config.items).forEach(([key, value]) => {
        reordered[key] = value;
        if (key === id) reordered[nextId] = cloneJSON(value);
    });
    config.items = reordered;
    syncHoldingJsonRawTextarea();
    return nextId;
}

function renameHoldingJsonItem(oldId, newId) {
    const config = editorState.conf["holdings.json"];
    const cleanId = String(newId || "").trim();
    if (!cleanId || cleanId === oldId || config.items?.[cleanId]) return oldId;
    const reordered = {};
    Object.entries(config.items || {}).forEach(([key, value]) => {
        reordered[key === oldId ? cleanId : key] = value;
    });
    config.items = reordered;
    return cleanId;
}

function moveHoldingJsonItem(id, direction) {
    const config = editorState.conf["holdings.json"];
    const entries = Object.entries(config.items || {});
    const index = entries.findIndex(([key]) => key === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) return id;
    const [entry] = entries.splice(index, 1);
    entries.splice(nextIndex, 0, entry);
    config.items = Object.fromEntries(entries);
    syncHoldingJsonRawTextarea();
    return id;
}

function syncHoldingJsonEditor() {
    const raw = document.getElementById("editor-json-textarea");
    if (!raw) return true;

    try {
        editorState.conf["holdings.json"] = JSON.parse(raw.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en holdings.json: ${error.message}`);
        return false;
    }
}

function syncHoldingJsonRawTextarea() {
    const raw = document.getElementById("editor-json-textarea");
    if (raw) raw.value = formatJSON(editorState.conf["holdings.json"]);
}

function renderJsonEditorPreservingHoldingScroll() {
    const editor = document.querySelector(".holding-json-editor");
    const scrollTop = editor?.scrollTop || 0;
    renderJsonEditor();
    const nextEditor = document.querySelector(".holding-json-editor");
    if (nextEditor) nextEditor.scrollTop = scrollTop;
}

function scrollToHoldingElement(selector) {
    const editor = document.querySelector(".holding-json-editor");
    const element = document.querySelector(selector);
    if (!editor || !element) return;
    const editorRect = editor.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    editor.scrollTop += elementRect.top - editorRect.top - 16;
}

function renderNotesJsonEditor() {
    const config = editorState.conf["notes.json"] || {};
    return `
        <div class="notes-json-editor">
            <section class="editor-form-section">
                <label>
                    Soft Deck
                    <input type="text" value="${escapeHTML(config.softDeck || "")}" data-notes-field="softDeck">
                </label>
                <label>
                    Hard Deck
                    <input type="text" value="${escapeHTML(config.hardDeck || "")}" data-notes-field="hardDeck">
                </label>
                <label>
                    Líneas visibles
                    <textarea class="editor-small-textarea" data-notes-list="lines">${escapeHTML((config.lines || []).join("\n"))}</textarea>
                </label>
                <label>
                    Texto placeholder para tus notas
                    <textarea class="editor-small-textarea" data-notes-field="placeholder">${escapeHTML(config.placeholder || "")}</textarea>
                </label>
                <label>
                    Imagen opcional
                    <input type="text" value="${escapeHTML(config.image || "")}" data-notes-field="image" list="notes-image-options" placeholder="images/...">
                </label>
                <datalist id="notes-image-options">
                    ${EDITOR_IMAGE_FILES.map(path => `<option value="${escapeHTML(path)}"></option>`).join("")}
                </datalist>
                ${config.image ? `<img src="${escapeHTML(config.image)}" class="notes-json-preview" alt="">` : ""}
            </section>
            <details class="editor-advanced notes-json-raw">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function initNotesJsonEditor(content) {
    const editor = content.querySelector(".notes-json-editor");

    editor.addEventListener("input", event => {
        updateNotesJsonField(event.target);
        clearEditorMessage();
    });

    editor.addEventListener("change", event => {
        if (event.target.dataset.notesField === "image") {
            renderJsonEditorPreservingNotesScroll();
        }
    });

    autoResizeTextareas(editor);
}

function updateNotesJsonField(target) {
    const config = editorState.conf["notes.json"];

    if (target.dataset.notesList) {
        config[target.dataset.notesList] = splitTextareaLines(target.value);
        autoResizeTextarea(target);
        syncNotesJsonRawTextarea();
        return;
    }

    if (target.dataset.notesField) {
        config[target.dataset.notesField] = target.value;
        if (target.matches("textarea")) autoResizeTextarea(target);
        syncNotesJsonRawTextarea();
    }
}

function syncNotesJsonEditor() {
    const raw = document.getElementById("editor-json-textarea");
    if (!raw) return true;

    try {
        editorState.conf["notes.json"] = JSON.parse(raw.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en notes.json: ${error.message}`);
        return false;
    }
}

function syncNotesJsonRawTextarea() {
    const raw = document.getElementById("editor-json-textarea");
    if (raw) raw.value = formatJSON(editorState.conf["notes.json"]);
}

function renderJsonEditorPreservingNotesScroll() {
    const editor = document.querySelector(".notes-json-editor");
    const scrollTop = editor?.scrollTop || 0;
    renderJsonEditor();
    const nextEditor = document.querySelector(".notes-json-editor");
    if (nextEditor) nextEditor.scrollTop = scrollTop;
}

function renderAtcJsonEditor() {
    const config = editorState.conf["atc.json"] || {};
    const pages = config.pages || {};
    return `
        <div class="atc-json-editor">
            ${["atc_ground", "atc_tower", "atc_overlord"].map(id => renderAtcPageEditor(id, pages[id] || {})).join("")}
            <details class="editor-advanced">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function renderAtcPageEditor(pageId, page) {
    const sections = {
        atc_ground: [["airportCharts", "Cartas aeropuerto"], ["atis", "ATIS"]],
        atc_tower: [["departureCharts", "Cartas salida"], ["arrivalCharts", "Cartas llegada"]],
        atc_overlord: [["authCodes", "Códigos autorización"]],
    }[pageId] || [];

    return `
        <section class="editor-form-section atc-page-editor">
            <div class="editor-section-header">
                <h4>${escapeHTML(pageId)}</h4>
            </div>
            <label>
                Título
                <input type="text" value="${escapeHTML(page.title || "")}" data-atc-page="${escapeHTML(pageId)}" data-atc-field="title">
            </label>
            ${sections.map(([section, label]) => section === "atis"
                ? renderAtcAtisEditor(pageId, page[section] || [], label)
                : renderAtcImageSectionEditor(pageId, section, page[section] || [], label)
            ).join("")}
        </section>
    `;
}

function renderAtcImageSectionEditor(pageId, section, images, label) {
    return `
        <div class="editor-subsection">
            <div class="editor-section-header">
                <h5>${escapeHTML(label)}</h5>
                <button type="button" class="editor-btn editor-btn-compact" data-atc-image-add="${escapeHTML(section)}" data-atc-page="${escapeHTML(pageId)}">Añadir imagen</button>
            </div>
            <div class="editor-card-list">
                ${images.map((image, index) => `
                    <article class="editor-mini-card" data-atc-image-anchor="${escapeHTML(pageId)}-${escapeHTML(section)}-${index}">
                        <input type="text" value="${escapeHTML(image.title || "")}" data-atc-page="${escapeHTML(pageId)}" data-atc-section="${escapeHTML(section)}" data-atc-index="${index}" data-atc-image-field="title" placeholder="Título">
                        <input type="text" value="${escapeHTML(image.src || "")}" data-atc-page="${escapeHTML(pageId)}" data-atc-section="${escapeHTML(section)}" data-atc-index="${index}" data-atc-image-field="src" list="editor-image-options" placeholder="images/...">
                        <div class="radio-json-row-actions">
                            <button type="button" class="editor-icon-btn" data-atc-page="${escapeHTML(pageId)}" data-atc-section="${escapeHTML(section)}" data-atc-image-move="${index}" data-atc-direction="-1" title="Subir">↑</button>
                            <button type="button" class="editor-icon-btn" data-atc-page="${escapeHTML(pageId)}" data-atc-section="${escapeHTML(section)}" data-atc-image-move="${index}" data-atc-direction="1" title="Bajar">↓</button>
                            <button type="button" class="editor-icon-btn danger" data-atc-page="${escapeHTML(pageId)}" data-atc-section="${escapeHTML(section)}" data-atc-image-delete="${index}" title="Eliminar">×</button>
                        </div>
                    </article>
                `).join("")}
            </div>
        </div>
    `;
}

function renderAtcAtisEditor(pageId, rows, label) {
    return `
        <div class="editor-subsection">
            <div class="editor-section-header">
                <h5>${escapeHTML(label)}</h5>
                <button type="button" class="editor-btn editor-btn-compact" data-atc-atis-add data-atc-page="${escapeHTML(pageId)}">Añadir ATIS</button>
            </div>
            <div class="editor-card-list">
                ${rows.map((row, index) => `
                    <article class="editor-mini-card atc-atis-row" data-atc-atis-anchor="${escapeHTML(pageId)}-${index}">
                        <input type="text" value="${escapeHTML(row.callsign || "")}" data-atc-page="${escapeHTML(pageId)}" data-atc-atis-index="${index}" data-atc-atis-field="callsign" placeholder="Callsign">
                        <input type="text" value="${escapeHTML(row.freq || "")}" data-atc-page="${escapeHTML(pageId)}" data-atc-atis-index="${index}" data-atc-atis-field="freq" placeholder="Freq">
                        <input type="text" value="${escapeHTML(row.notes || "")}" data-atc-page="${escapeHTML(pageId)}" data-atc-atis-index="${index}" data-atc-atis-field="notes" placeholder="Notas">
                        <button type="button" class="editor-icon-btn danger" data-atc-page="${escapeHTML(pageId)}" data-atc-atis-delete="${index}" title="Eliminar">×</button>
                    </article>
                `).join("")}
            </div>
        </div>
    `;
}

function initAtcJsonEditor(content) {
    const editor = content.querySelector(".atc-json-editor");
    appendImageDatalist(editor);

    editor.addEventListener("input", event => {
        updateAtcJsonField(event.target);
        clearEditorMessage();
    });

    editor.addEventListener("click", event => {
        const pageId = event.target.dataset.atcPage;
        if (!pageId) return;

        if (event.target.dataset.atcImageAdd) {
            getAtcPageConfig(pageId)[event.target.dataset.atcImageAdd] ||= [];
            getAtcPageConfig(pageId)[event.target.dataset.atcImageAdd].push({ title: "Nueva imagen", src: EDITOR_IMAGE_FILES[0] || "" });
            const index = getAtcPageConfig(pageId)[event.target.dataset.atcImageAdd].length - 1;
            syncAtcJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".atc-json-editor", `[data-atc-image-anchor="${pageId}-${event.target.dataset.atcImageAdd}-${index}"]`);
            return;
        }

        if (event.target.dataset.atcImageDelete != null) {
            getAtcPageConfig(pageId)[event.target.dataset.atcSection]?.splice(Number(event.target.dataset.atcImageDelete), 1);
            syncAtcJsonRawTextarea();
            renderJsonEditorPreservingGenericScroll(".atc-json-editor");
            return;
        }

        if (event.target.dataset.atcImageMove != null) {
            const section = event.target.dataset.atcSection;
            const nextIndex = moveArrayItem(getAtcPageConfig(pageId)[section], Number(event.target.dataset.atcImageMove), Number(event.target.dataset.atcDirection));
            syncAtcJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".atc-json-editor", `[data-atc-image-anchor="${pageId}-${section}-${nextIndex}"]`);
            return;
        }

        if (event.target.dataset.atcAtisAdd != null) {
            getAtcPageConfig(pageId).atis ||= [];
            getAtcPageConfig(pageId).atis.push({ callsign: "", freq: "", notes: "" });
            const index = getAtcPageConfig(pageId).atis.length - 1;
            syncAtcJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".atc-json-editor", `[data-atc-atis-anchor="${pageId}-${index}"]`);
            return;
        }

        if (event.target.dataset.atcAtisDelete != null) {
            getAtcPageConfig(pageId).atis?.splice(Number(event.target.dataset.atcAtisDelete), 1);
            syncAtcJsonRawTextarea();
            renderJsonEditorPreservingGenericScroll(".atc-json-editor");
        }
    });
}

function updateAtcJsonField(target) {
    const pageId = target.dataset.atcPage;
    if (!pageId) return;
    const page = getAtcPageConfig(pageId);

    if (target.dataset.atcField) page[target.dataset.atcField] = target.value;
    if (target.dataset.atcImageField) {
        page[target.dataset.atcSection][Number(target.dataset.atcIndex)][target.dataset.atcImageField] = target.value;
    }
    if (target.dataset.atcAtisField) {
        page.atis[Number(target.dataset.atcAtisIndex)][target.dataset.atcAtisField] = target.value;
    }
    syncAtcJsonRawTextarea();
}

function getAtcPageConfig(pageId) {
    const config = editorState.conf["atc.json"];
    config.pages ||= {};
    config.pages[pageId] ||= { title: pageId };
    return config.pages[pageId];
}

function syncAtcJsonEditor() {
    return syncJsonRawEditor("atc.json");
}

function syncAtcJsonRawTextarea() {
    syncJsonRawTextarea("atc.json");
}

function renderPackagesJsonEditor() {
    const packages = editorState.conf["packages.json"] || [];
    return `
        <div class="packages-json-editor">
            ${renderKnownIdsDatalist()}
            <div class="editor-section-header">
                <h4>Paquetes</h4>
                <button type="button" class="editor-btn" data-package-add>Añadir paquete</button>
            </div>
            <div class="package-editor-list">
                ${packages.map((pkg, index) => renderPackageEditor(pkg, index)).join("")}
            </div>
            <details class="editor-advanced">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(packages))}</textarea>
            </details>
        </div>
    `;
}

function renderPackageEditor(pkg, packageIndex) {
    return `
        <section class="editor-form-section package-editor" data-package-anchor="${packageIndex}">
            <header>
                <label class="editor-field-label">
                    ID paquete
                    <input type="text" value="${escapeHTML(pkg.id || "")}" data-package-index="${packageIndex}" data-package-field="id" placeholder="id">
                </label>
                <label class="editor-field-label">
                    Nombre visible
                    <input type="text" value="${escapeHTML(pkg.label || "")}" data-package-index="${packageIndex}" data-package-field="label" placeholder="label">
                </label>
                <div class="radio-json-row-actions">
                    <button type="button" class="editor-btn editor-btn-compact" data-tab-add="${packageIndex}">Añadir pestaña</button>
                    <button type="button" class="editor-icon-btn" data-package-move="${packageIndex}" data-package-direction="-1" title="Subir">↑</button>
                    <button type="button" class="editor-icon-btn" data-package-move="${packageIndex}" data-package-direction="1" title="Bajar">↓</button>
                    <button type="button" class="editor-icon-btn" data-package-duplicate="${packageIndex}" title="Duplicar paquete">D</button>
                    <button type="button" class="editor-icon-btn danger" data-package-delete="${packageIndex}" title="Eliminar">×</button>
                </div>
            </header>
            <div class="package-tab-list">
                ${(pkg.tabs || []).map((tab, tabIndex) => renderPackageTabEditor(tab, packageIndex, tabIndex)).join("")}
            </div>
        </section>
    `;
}

function renderPackageTabEditor(tab, packageIndex, tabIndex) {
    const valid = getKnownTabIds().has(tab.id);
    return `
        <article class="package-tab-editor ${valid ? "" : "invalid-id"}" data-package-tab-anchor="${packageIndex}-${tabIndex}">
            <label class="editor-field-label">
                ID página
                <input type="text" value="${escapeHTML(tab.id || "")}" data-package-index="${packageIndex}" data-tab-index="${tabIndex}" data-tab-field="id" list="known-tab-id-options" placeholder="page id">
            </label>
            <label class="editor-field-label">
                Nombre pestaña
                <input type="text" value="${escapeHTML(tab.label || "")}" data-package-index="${packageIndex}" data-tab-index="${tabIndex}" data-tab-field="label" placeholder="label">
            </label>
            <span class="id-status">${valid ? "OK" : "ID no encontrado"}</span>
            <div class="radio-json-row-actions">
                <button type="button" class="editor-icon-btn" data-tab-move="${tabIndex}" data-package-index="${packageIndex}" data-tab-direction="-1" title="Subir">↑</button>
                <button type="button" class="editor-icon-btn" data-tab-move="${tabIndex}" data-package-index="${packageIndex}" data-tab-direction="1" title="Bajar">↓</button>
                <button type="button" class="editor-icon-btn danger" data-tab-delete="${tabIndex}" data-package-index="${packageIndex}" title="Eliminar">×</button>
            </div>
        </article>
    `;
}

function initPackagesJsonEditor(content) {
    const editor = content.querySelector(".packages-json-editor");
    editor.addEventListener("input", event => {
        updatePackagesJsonField(event.target);
        clearEditorMessage();
    });
    editor.addEventListener("change", event => {
        if (event.target.dataset.tabField === "id") renderJsonEditorPreservingGenericScroll(".packages-json-editor");
    });
    editor.addEventListener("click", event => {
        const packages = editorState.conf["packages.json"];
        if (event.target.dataset.packageAdd != null) {
            packages.push({ id: "NUEVO", label: "NUEVO", tabs: [] });
            const index = packages.length - 1;
            syncPackagesJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".packages-json-editor", `[data-package-anchor="${index}"]`);
            return;
        }
        if (event.target.dataset.packageDelete != null) {
            packages.splice(Number(event.target.dataset.packageDelete), 1);
            syncPackagesJsonRawTextarea();
            renderJsonEditorPreservingGenericScroll(".packages-json-editor");
            return;
        }
        if (event.target.dataset.packageDuplicate != null) {
            const index = duplicatePackageJsonItem(Number(event.target.dataset.packageDuplicate));
            renderJsonEditor();
            scrollToGenericElement(".packages-json-editor", `[data-package-anchor="${index}"]`);
            return;
        }
        if (event.target.dataset.packageMove != null) {
            const nextIndex = moveArrayItem(packages, Number(event.target.dataset.packageMove), Number(event.target.dataset.packageDirection));
            syncPackagesJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".packages-json-editor", `[data-package-anchor="${nextIndex}"]`);
            return;
        }
        const packageIndex = Number(event.target.dataset.packageIndex);
        if (event.target.dataset.tabAdd != null) {
            packages[Number(event.target.dataset.tabAdd)].tabs ||= [];
            packages[Number(event.target.dataset.tabAdd)].tabs.push({ id: "", label: "" });
            const nextTabIndex = packages[Number(event.target.dataset.tabAdd)].tabs.length - 1;
            syncPackagesJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".packages-json-editor", `[data-package-tab-anchor="${event.target.dataset.tabAdd}-${nextTabIndex}"]`);
            return;
        }
        if (event.target.dataset.tabDelete != null) {
            packages[packageIndex].tabs.splice(Number(event.target.dataset.tabDelete), 1);
            syncPackagesJsonRawTextarea();
            renderJsonEditorPreservingGenericScroll(".packages-json-editor");
            return;
        }
        if (event.target.dataset.tabMove != null) {
            const nextIndex = moveArrayItem(packages[packageIndex].tabs, Number(event.target.dataset.tabMove), Number(event.target.dataset.tabDirection));
            syncPackagesJsonRawTextarea();
            renderJsonEditor();
            scrollToGenericElement(".packages-json-editor", `[data-package-tab-anchor="${packageIndex}-${nextIndex}"]`);
        }
    });
}

function updatePackagesJsonField(target) {
    const packages = editorState.conf["packages.json"];
    const packageIndex = Number(target.dataset.packageIndex);
    if (!Number.isInteger(packageIndex) || !packages[packageIndex]) return;
    if (target.dataset.packageField) packages[packageIndex][target.dataset.packageField] = target.value;
    if (target.dataset.tabField) {
        const tab = packages[packageIndex].tabs?.[Number(target.dataset.tabIndex)];
        if (tab) tab[target.dataset.tabField] = target.value;
    }
    syncPackagesJsonRawTextarea();
}

function duplicatePackageJsonItem(index) {
    const packages = editorState.conf["packages.json"];
    const original = packages[index];
    if (!original) return index;
    const duplicate = cloneJSON(original);
    duplicate.id = makeUniqueId(original.id || `paquete_${index + 1}`, Object.fromEntries(packages.map(pkg => [pkg.id, true])));
    duplicate.label = `${original.label || original.id || "Paquete"} copia`;
    packages.splice(index + 1, 0, duplicate);
    syncPackagesJsonRawTextarea();
    return index + 1;
}

function syncPackagesJsonEditor() {
    return syncJsonRawEditor("packages.json");
}

function syncPackagesJsonRawTextarea() {
    syncJsonRawTextarea("packages.json");
}

function renderPagesJsonEditor() {
    const config = editorState.conf["pages.json"] || {};
    const pages = config.pages || {};
    const templates = config.templates || {};
    return `
        <div class="pages-json-editor">
            ${renderKnownIdsDatalist()}
            ${renderImageDatalistMarkup()}
            <section class="editor-form-section">
                <div class="editor-section-header">
                    <h4>Crear página desde plantilla</h4>
                    <div class="editor-actions">
                        <input type="text" data-new-page-id placeholder="nuevo_id">
                        <select data-new-page-template>
                            ${Object.keys(templates).map(id => `<option value="${escapeHTML(id)}">${escapeHTML(id)}</option>`).join("")}
                        </select>
                        <button type="button" class="editor-btn" data-page-add>Crear</button>
                    </div>
                </div>
            </section>
            <div class="page-editor-list">
                ${Object.entries(pages).map(([id, page]) => renderPageConfigEditor(id, page, false)).join("")}
            </div>
            <details class="editor-advanced">
                <summary>Plantillas</summary>
                <div class="page-editor-list">
                    ${Object.entries(templates).map(([id, page]) => renderPageConfigEditor(id, page, true)).join("")}
                </div>
            </details>
            <details class="editor-advanced">
                <summary>JSON crudo avanzado</summary>
                <textarea id="editor-json-textarea" class="editor-textarea" spellcheck="false">${escapeHTML(formatJSON(config))}</textarea>
            </details>
        </div>
    `;
}

function renderPageConfigEditor(id, page, isTemplate) {
    const scope = isTemplate ? "template" : "page";
    const effectivePage = getEffectivePageEditorConfig(page);
    return `
        <section class="editor-form-section page-config-editor" data-page-scope="${scope}" data-page-id="${escapeHTML(id)}">
            <header class="editor-section-header">
                <input type="text" value="${escapeHTML(id)}" data-page-rename="${escapeHTML(id)}" data-page-scope="${scope}">
                <select data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-field="type">
                    ${["operation", "standard", "html"].map(type => `<option value="${type}"${effectivePage.type === type ? " selected" : ""}>${type}</option>`).join("")}
                </select>
                <div class="radio-json-row-actions">
                    <button type="button" class="editor-icon-btn" data-page-duplicate="${escapeHTML(id)}" data-page-scope="${scope}" title="Duplicar ${isTemplate ? "plantilla" : "pagina"}">D</button>
                    <button type="button" class="editor-icon-btn danger" data-page-delete="${escapeHTML(id)}" data-page-scope="${scope}" title="Eliminar">×</button>
                </div>
            </header>
            ${renderPageConfigFields(id, effectivePage, scope)}
        </section>
    `;
}

function getEffectivePageEditorConfig(page) {
    const template = page?.template ? editorState.conf["pages.json"]?.templates?.[page.template] || {} : {};
    return { ...cloneJSON(template), ...cloneJSON(page || {}) };
}

function renderPageConfigFields(id, page, scope) {
    if (page.type === "html") {
        return `<label>HTML<input type="text" value="${escapeHTML(page.html || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-field="html" list="known-html-options"></label>${renderHtmlDatalist()}`;
    }
    if (page.type === "standard") return renderStandardPageConfigEditor(id, page, scope);
    return renderOperationPageConfigEditor(id, page, scope);
}

function renderOperationPageConfigEditor(id, page, scope) {
    return `
        <label>Título<input type="text" value="${escapeHTML(page.title || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-field="title"></label>
        <label>Situación<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-field="situation">${escapeHTML(page.situation || "")}</textarea></label>
        <label>Importante<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-list="important">${escapeHTML((page.important || []).join("\n"))}</textarea></label>
        <label>Regreso<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-field="return">${escapeHTML(page.return || "")}</textarea></label>
        ${renderFenceEditor(id, page.fenceIn || [], scope)}
        ${renderObjectivesEditor(id, page.objectives || {}, scope)}
    `;
}

function renderFenceEditor(id, items, scope) {
    return `
        <div class="editor-subsection">
            <div class="editor-section-header"><h5>FENCE-IN</h5><button type="button" class="editor-btn editor-btn-compact" data-fence-add="${escapeHTML(id)}" data-page-scope="${scope}">Añadir</button></div>
            ${items.map((item, index) => `
                <article class="editor-mini-card page-fence-row" data-fence-anchor="${escapeHTML(scope)}-${escapeHTML(id)}-${index}">
                    <input type="text" value="${escapeHTML(item.letter || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-fence-index="${index}" data-fence-field="letter">
                    <input type="text" value="${escapeHTML(item.label || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-fence-index="${index}" data-fence-field="label">
                    <input type="text" value="${escapeHTML(item.text || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-fence-index="${index}" data-fence-field="text">
                    <button type="button" class="editor-icon-btn danger" data-fence-delete="${index}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}">×</button>
                </article>
            `).join("")}
        </div>
    `;
}

function renderObjectivesEditor(id, objectives, scope) {
    return `
        <div class="editor-subsection">
            <label>Intro objetivos<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-objectives-list="intro">${escapeHTML((objectives.intro || []).join("\n"))}</textarea></label>
            <div class="editor-section-header"><h5>Objetivos</h5><button type="button" class="editor-btn editor-btn-compact" data-objective-add="${escapeHTML(id)}" data-page-scope="${scope}">Añadir objetivo</button></div>
            ${(objectives.items || []).map((item, index) => `
                <article class="editor-mini-card objective-editor" data-objective-anchor="${escapeHTML(scope)}-${escapeHTML(id)}-${index}">
                    <input type="text" value="${escapeHTML(item.title || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-objective-index="${index}" data-objective-field="title" placeholder="Título">
                    <input type="text" value="${escapeHTML(item.image || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-objective-index="${index}" data-objective-field="image" list="editor-image-options" placeholder="Imagen">
                    <textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-objective-index="${index}" data-objective-list="details" placeholder="Coordenadas / detalles">${escapeHTML((item.details || []).join("\n"))}</textarea>
                    <button type="button" class="editor-icon-btn danger" data-objective-delete="${index}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}">×</button>
                </article>
            `).join("")}
        </div>
    `;
}

function renderStandardPageConfigEditor(id, page, scope) {
    return `
        <label>Título<input type="text" value="${escapeHTML(page.title || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-page-field="title"></label>
        <div class="editor-section-header"><h5>Bloques</h5><button type="button" class="editor-btn editor-btn-compact" data-block-add="${escapeHTML(id)}" data-page-scope="${scope}">Añadir bloque</button></div>
        ${(page.blocks || []).map((block, index) => renderPageBlockConfigEditor(id, block, index, scope)).join("")}
    `;
}

function renderPageBlockConfigEditor(id, block, index, scope) {
    return `
        <article class="editor-mini-card page-block-editor" data-page-block-anchor="${escapeHTML(scope)}-${escapeHTML(id)}-${index}">
            <select data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-index="${index}" data-block-field="type">
                ${Object.keys(HTML_BLOCK_TYPES).filter(type => type !== "raw").concat("table").map(type => `<option value="${type}"${block.type === type ? " selected" : ""}>${type}</option>`).join("")}
            </select>
            <input type="text" value="${escapeHTML(block.title || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-index="${index}" data-block-field="title" placeholder="Título">
            ${renderPageBlockValueEditor(id, block, index, scope)}
            <div class="radio-json-row-actions">
                <button type="button" class="editor-icon-btn" data-block-move="${index}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-direction="-1">↑</button>
                <button type="button" class="editor-icon-btn" data-block-move="${index}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-direction="1">↓</button>
                <button type="button" class="editor-icon-btn danger" data-block-delete="${index}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}">×</button>
            </div>
        </article>
    `;
}

function renderPageBlockValueEditor(id, block, index, scope) {
    if (block.type === "image") {
        return `<input type="text" value="${escapeHTML(block.src || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-index="${index}" data-block-field="src" list="editor-image-options" placeholder="Imagen">`;
    }
    if (block.type === "textarea") {
        return `<input type="text" value="${escapeHTML(block.placeholder || "")}" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-index="${index}" data-block-field="placeholder" placeholder="Placeholder">`;
    }
    if (block.type === "list" || block.type === "checklist") {
        return `<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-index="${index}" data-block-list="items">${escapeHTML((block.items || []).join("\n"))}</textarea>`;
    }
    if (block.type === "table") {
        return `<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-table>${escapeHTML((block.rows || []).map(row => row.join(" | ")).join("\n"))}</textarea>`;
    }
    return `<textarea class="editor-small-textarea" data-page-id="${escapeHTML(id)}" data-page-scope="${scope}" data-block-index="${index}" data-block-list="lines">${escapeHTML((block.lines || toLines(block.text)).join("\n"))}</textarea>`;
}

function initPagesJsonEditor(content) {
    const editor = content.querySelector(".pages-json-editor");
    appendImageDatalist(editor);
    editor.addEventListener("input", event => {
        updatePagesJsonField(event.target);
        clearEditorMessage();
    });
    editor.addEventListener("change", event => {
        if (event.target.dataset.pageRename || event.target.dataset.pageField === "type" || event.target.dataset.blockField === "type") {
            if (event.target.dataset.pageRename) renamePageConfig(event.target.dataset.pageScope, event.target.dataset.pageRename, event.target.value);
            syncPagesJsonRawTextarea();
            renderJsonEditorPreservingGenericScroll(".pages-json-editor");
        }
    });
    editor.addEventListener("click", event => {
        if (event.target.dataset.pageAdd != null) {
            const id = createPageFromTemplate(editor.querySelector("[data-new-page-id]").value, editor.querySelector("[data-new-page-template]").value);
            renderJsonEditor();
            scrollToGenericElement(".pages-json-editor", `[data-page-id="${cssEscape(id)}"]`);
            return;
        }
        handlePagesJsonAction(event.target);
    });
    autoResizeTextareas(editor);
}

function updatePagesJsonField(target) {
    const page = getPageConfigEntry(target.dataset.pageScope, target.dataset.pageId);
    if (!page || target.dataset.pageRename) return;
    if (target.dataset.pageField) page[target.dataset.pageField] = target.value;
    if (target.dataset.pageList) page[target.dataset.pageList] = splitTextareaLines(target.value);
    if (target.dataset.fenceField) page.fenceIn[Number(target.dataset.fenceIndex)][target.dataset.fenceField] = target.value;
    if (target.dataset.objectivesList) {
        page.objectives ||= {};
        page.objectives[target.dataset.objectivesList] = splitTextareaLines(target.value);
    }
    if (target.dataset.objectiveField) page.objectives.items[Number(target.dataset.objectiveIndex)][target.dataset.objectiveField] = target.value;
    if (target.dataset.objectiveList) page.objectives.items[Number(target.dataset.objectiveIndex)][target.dataset.objectiveList] = splitTextareaLines(target.value);
    if (target.dataset.blockField) page.blocks[Number(target.dataset.blockIndex)][target.dataset.blockField] = target.value;
    if (target.dataset.blockList) page.blocks[Number(target.dataset.blockIndex)][target.dataset.blockList] = splitTextareaLines(target.value);
    if (target.dataset.blockTable != null) page.blocks[Number(target.dataset.blockIndex)].rows = splitTextareaLines(target.value).map(line => line.split("|").map(cell => cell.trim()));
    if (target.matches("textarea")) autoResizeTextarea(target);
    syncPagesJsonRawTextarea();
}

function handlePagesJsonAction(target) {
    const id = target.dataset.pageId;
    const scope = target.dataset.pageScope;
    const page = getPageConfigEntry(scope, id);
    if (target.dataset.pageDelete) {
        delete getPageConfigBucket(scope)[target.dataset.pageDelete];
        syncPagesJsonRawTextarea();
        renderJsonEditorPreservingGenericScroll(".pages-json-editor");
        return;
    }
    if (target.dataset.pageDuplicate) {
        const nextId = duplicatePageConfig(scope, target.dataset.pageDuplicate);
        renderJsonEditor();
        scrollToGenericElement(".pages-json-editor", `[data-page-scope="${scope}"][data-page-id="${cssEscape(nextId)}"]`);
        return;
    }
    if (!page) return;
    if (target.dataset.fenceAdd) {
        page.fenceIn ||= [];
        page.fenceIn.push({ letter: "", label: "", text: "" });
        syncPagesJsonRawTextarea();
        renderJsonEditor();
        scrollToGenericElement(".pages-json-editor", `[data-fence-anchor="${scope}-${id}-${page.fenceIn.length - 1}"]`);
        return;
    }
    if (target.dataset.fenceDelete != null) {
        page.fenceIn?.splice(Number(target.dataset.fenceDelete), 1);
        syncPagesJsonRawTextarea();
        renderJsonEditorPreservingGenericScroll(".pages-json-editor");
        return;
    }
    if (target.dataset.objectiveAdd) {
        page.objectives ||= { intro: [], items: [] };
        page.objectives.items ||= [];
        page.objectives.items.push({ title: "Nuevo objetivo", image: "", details: [] });
        syncPagesJsonRawTextarea();
        renderJsonEditor();
        scrollToGenericElement(".pages-json-editor", `[data-objective-anchor="${scope}-${id}-${page.objectives.items.length - 1}"]`);
        return;
    }
    if (target.dataset.objectiveDelete != null) {
        page.objectives?.items?.splice(Number(target.dataset.objectiveDelete), 1);
        syncPagesJsonRawTextarea();
        renderJsonEditorPreservingGenericScroll(".pages-json-editor");
        return;
    }
    if (target.dataset.blockAdd) {
        page.blocks ||= [];
        page.blocks.push({ type: "card", title: "Nuevo bloque", lines: ["Contenido."] });
        syncPagesJsonRawTextarea();
        renderJsonEditor();
        scrollToGenericElement(".pages-json-editor", `[data-page-block-anchor="${scope}-${id}-${page.blocks.length - 1}"]`);
        return;
    }
    if (target.dataset.blockDelete != null) {
        page.blocks?.splice(Number(target.dataset.blockDelete), 1);
        syncPagesJsonRawTextarea();
        renderJsonEditorPreservingGenericScroll(".pages-json-editor");
        return;
    }
    if (target.dataset.blockMove != null) {
        const nextIndex = moveArrayItem(page.blocks, Number(target.dataset.blockMove), Number(target.dataset.blockDirection));
        syncPagesJsonRawTextarea();
        renderJsonEditor();
        scrollToGenericElement(".pages-json-editor", `[data-page-block-anchor="${scope}-${id}-${nextIndex}"]`);
        return;
    }
}

function getPageConfigBucket(scope) {
    const config = editorState.conf["pages.json"];
    config.pages ||= {};
    config.templates ||= {};
    return scope === "template" ? config.templates : config.pages;
}

function getPageConfigEntry(scope, id) {
    return getPageConfigBucket(scope)?.[id];
}

function createPageFromTemplate(requestedId, templateId) {
    const config = editorState.conf["pages.json"];
    const pages = getPageConfigBucket("page");
    let id = String(requestedId || "").trim() || `page_${Object.keys(pages).length + 1}`;
    while (pages[id]) id = `${id}_copy`;
    pages[id] = cloneJSON(config.templates?.[templateId] || { type: "standard", title: "Nueva página", blocks: [] });
    syncPagesJsonRawTextarea();
    return id;
}

function duplicatePageConfig(scope, id) {
    const bucket = getPageConfigBucket(scope);
    const nextId = makeUniqueId(id, bucket);
    const reordered = {};
    Object.entries(bucket).forEach(([key, value]) => {
        reordered[key] = value;
        if (key === id) reordered[nextId] = cloneJSON(value);
    });
    if (scope === "template") editorState.conf["pages.json"].templates = reordered;
    else editorState.conf["pages.json"].pages = reordered;
    syncPagesJsonRawTextarea();
    return nextId;
}

function renamePageConfig(scope, oldId, newId) {
    const bucket = getPageConfigBucket(scope);
    const cleanId = String(newId || "").trim();
    if (!cleanId || cleanId === oldId || bucket[cleanId]) return oldId;
    const reordered = {};
    Object.entries(bucket).forEach(([key, value]) => {
        reordered[key === oldId ? cleanId : key] = value;
    });
    if (scope === "template") editorState.conf["pages.json"].templates = reordered;
    else editorState.conf["pages.json"].pages = reordered;
    return cleanId;
}

function cloneJSON(value) {
    return JSON.parse(JSON.stringify(value));
}

function makeUniqueId(baseId, bucket) {
    const cleanBase = String(baseId || "item").trim() || "item";
    let id = `${cleanBase}_copy`;
    let index = 2;
    while (bucket[id]) {
        id = `${cleanBase}_copy${index}`;
        index += 1;
    }
    return id;
}

function syncPagesJsonEditor() {
    return syncJsonRawEditor("pages.json");
}

function syncPagesJsonRawTextarea() {
    syncJsonRawTextarea("pages.json");
}

function getKnownTabIds() {
    const ids = new Set();
    Object.keys(editorState.conf["pages.json"]?.pages || {}).forEach(id => ids.add(id));
    Object.keys(editorState.conf["atc.json"]?.pages || {}).forEach(id => ids.add(id));
    Object.keys(editorState.conf["holdings.json"]?.items || {}).forEach(id => ids.add(id));
    Object.entries(editorState.conf["loadouts.json"] || {}).forEach(([id, value]) => {
        if (Array.isArray(value)) ids.add(id);
    });
    getEditorHtmlCandidates().forEach(file => ids.add(file.replace(/\.html$/, "")));
    return ids;
}

function renderKnownIdsDatalist() {
    return `
        <datalist id="known-tab-id-options">
            ${[...getKnownTabIds()].sort().map(id => `<option value="${escapeHTML(id)}"></option>`).join("")}
        </datalist>
    `;
}

function renderHtmlDatalist() {
    return `
        <datalist id="known-html-options">
            ${getEditorHtmlCandidates().map(file => `<option value="${escapeHTML(file.replace(/\.html$/, ""))}"></option>`).join("")}
        </datalist>
    `;
}

function renderImageDatalistMarkup() {
    return `
        <datalist id="editor-image-options">
            ${EDITOR_IMAGE_FILES.map(path => `<option value="${escapeHTML(path)}"></option>`).join("")}
        </datalist>
    `;
}

function appendImageDatalist(root) {
    if (!root || root.querySelector("#editor-image-options")) return;
    root.insertAdjacentHTML("beforeend", renderImageDatalistMarkup());
}

function syncJsonRawEditor(file) {
    const raw = document.getElementById("editor-json-textarea");
    if (!raw) return true;
    try {
        editorState.conf[file] = JSON.parse(raw.value);
        return true;
    } catch (error) {
        showEditorError(`JSON inválido en ${file}: ${error.message}`);
        return false;
    }
}

function syncJsonRawTextarea(file) {
    const raw = document.getElementById("editor-json-textarea");
    if (raw) raw.value = formatJSON(editorState.conf[file]);
}

function renderJsonEditorPreservingGenericScroll(selector) {
    const editor = document.querySelector(selector);
    const scrollTop = editor?.scrollTop || 0;
    renderJsonEditor();
    const nextEditor = document.querySelector(selector);
    if (nextEditor) nextEditor.scrollTop = scrollTop;
}

function scrollToGenericElement(containerSelector, itemSelector) {
    const container = document.querySelector(containerSelector);
    const element = document.querySelector(itemSelector);
    if (!container || !element) return;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const topDelta = elementRect.top - containerRect.top;
    const bottomDelta = elementRect.bottom - containerRect.bottom;
    if (topDelta < 16) {
        container.scrollTop += topDelta - 16;
    } else if (bottomDelta > -16) {
        container.scrollTop += bottomDelta + 16;
    }
}

function scrollToLoadoutElement(selector) {
    const editor = document.querySelector(".loadout-json-editor");
    const element = document.querySelector(selector);
    if (!editor || !element) return;
    const editorRect = editor.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    editor.scrollTop += elementRect.top - editorRect.top - 16;
}

function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replaceAll('"', '\\"');
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
            const blockIndex = event.target.closest(".html-visual-block")?.dataset.htmlBlockAnchor;
            addElementToVisualBlock(event.target.closest(".html-visual-block"), action);
            renderHtmlEditor();
            scrollToGenericElement(".html-visual-editor", `[data-html-block-anchor="${blockIndex}"]`);
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
            const nextIndex = moveHtmlBlock(currentBlocks[index], action === "move-up" ? -1 : 1);
            renderHtmlEditor();
            scrollToGenericElement(".html-visual-editor", `[data-html-block-anchor="${nextIndex}"]`);
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
        const nextIndex = getEditableHtmlBlocks(editorState.htmlDocs[editorState.activeHtmlFile]).length - 1;
        renderHtmlEditor();
        scrollToGenericElement(".html-visual-editor", `[data-html-block-anchor="${nextIndex}"]`);
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
        <article class="html-visual-block" data-html-block-anchor="${block.editorIndex}">
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
    if (!sibling) return block.editorIndex;

    if (direction < 0) {
        block.node.parentNode.insertBefore(block.node, sibling);
    } else {
        block.node.parentNode.insertBefore(sibling, block.node);
    }

    syncActiveHtmlPage();
    return block.editorIndex + direction;
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
