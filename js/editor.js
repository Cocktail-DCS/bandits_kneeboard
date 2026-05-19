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

const EDITOR_RADIO_COLOR_OPTIONS = [
    ["", "Sin color"],
    ["orange", "Naranja"],
    ["orange-dark", "Naranja oscuro"],
    ["blue", "Azul"],
    ["blue-dark", "Azul oscuro"],
    ["purple", "Morado"],
    ["yellow", "Amarillo"],
    ["green-light", "Verde claro"],
    ["green", "Verde"],
    ["red", "Rojo"],
    ["red-light", "Rojo claro"],
    ["black", "Negro"],
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
    const isRadioEditor = editorState.activeConfFile === "radios.json";
    const isTankerEditor = editorState.activeConfFile === "tankers.json";
    const isLoadoutEditor = editorState.activeConfFile === "loadouts.json";
    const isHoldingEditor = editorState.activeConfFile === "holdings.json";
    const isNotesEditor = editorState.activeConfFile === "notes.json";
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
                ${isRadioEditor ? renderRadioJsonEditor() : isTankerEditor ? renderTankerJsonEditor() : isLoadoutEditor ? renderLoadoutJsonEditor() : isHoldingEditor ? renderHoldingJsonEditor() : isNotesEditor ? renderNotesJsonEditor() : `
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
                ${(config.groups || []).map((group, index) => `
                    <button type="button" class="editor-btn" data-radio-add-row="${index}">
                        Añadir fila ${escapeHTML(group.channelHeader || `Grupo ${index + 1}`)}
                    </button>
                `).join("")}
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
        <td><input type="text" value="${escapeHTML(row.radio)}" data-radio-group="${groupIndex}" data-radio-row="${rowIndex}" data-radio-field="radio"></td>
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
        const addGroupIndex = event.target.dataset.radioAddRow;
        if (addGroupIndex != null) {
            addRadioJsonRow(Number(addGroupIndex));
            renderJsonEditorPreservingRadioScroll();
            showEditorMessage("Fila añadida.");
            return;
        }

        const moveGroupIndex = event.target.dataset.radioMoveGroup;
        const moveRowIndex = event.target.dataset.radioMoveRow;
        const moveDirection = event.target.dataset.radioMoveDirection;
        if (moveGroupIndex != null && moveRowIndex != null && moveDirection != null) {
            moveRadioJsonRow(Number(moveGroupIndex), Number(moveRowIndex), Number(moveDirection));
            renderJsonEditorPreservingRadioScroll();
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

function addRadioJsonRow(groupIndex) {
    const group = editorState.conf["radios.json"].groups?.[groupIndex];
    if (!group) return;
    group.rows ||= [];
    group.rows.push({ radio: "", callsign: "", freq: "", color: "" });
    syncRadioJsonRawTextarea();
}

function deleteRadioJsonRow(groupIndex, rowIndex) {
    const rows = editorState.conf["radios.json"].groups?.[groupIndex]?.rows;
    if (!rows?.[rowIndex]) return;
    rows.splice(rowIndex, 1);
    syncRadioJsonRawTextarea();
}

function moveRadioJsonRow(groupIndex, rowIndex, direction) {
    const rows = editorState.conf["radios.json"].groups?.[groupIndex]?.rows;
    if (!rows?.[rowIndex]) return;

    const nextIndex = rowIndex + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) return;

    const [row] = rows.splice(rowIndex, 1);
    rows.splice(nextIndex, 0, row);
    syncRadioJsonRawTextarea();
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
        <tr>
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
        <article class="tanker-note-editor">
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
                    <div class="tanker-note-line">
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
            renderJsonEditorPreservingTankerScroll();
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
            moveArrayItem(editorState.conf["tankers.json"].tankers, Number(event.target.dataset.tankerMove), Number(event.target.dataset.tankerDirection));
            syncTankerJsonRawTextarea();
            renderJsonEditorPreservingTankerScroll();
            return;
        }

        if (event.target.dataset.noteAdd != null) {
            addTankerJsonNote();
            renderJsonEditorPreservingTankerScroll();
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
            moveArrayItem(editorState.conf["tankers.json"].notes, Number(event.target.dataset.noteMove), Number(event.target.dataset.noteDirection));
            syncTankerJsonRawTextarea();
            renderJsonEditorPreservingTankerScroll();
            return;
        }

        if (event.target.dataset.noteLineAdd != null) {
            addTankerJsonNoteLine(Number(event.target.dataset.noteIndex));
            renderJsonEditorPreservingTankerScroll();
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
    if (!items?.[index]) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(nextIndex, 0, item);
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
            moveArrayItem(editorState.conf["loadouts.json"][event.target.dataset.loadoutItemMove], Number(event.target.dataset.loadoutIndex), Number(event.target.dataset.loadoutDirection));
            syncLoadoutJsonRawTextarea();
            renderJsonEditorPreservingLoadoutScroll();
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

        if (event.target.dataset.holdingMove) {
            moveHoldingJsonItem(event.target.dataset.holdingMove, Number(event.target.dataset.holdingDirection));
            renderJsonEditorPreservingHoldingScroll();
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
    if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) return;
    const [entry] = entries.splice(index, 1);
    entries.splice(nextIndex, 0, entry);
    config.items = Object.fromEntries(entries);
    syncHoldingJsonRawTextarea();
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
