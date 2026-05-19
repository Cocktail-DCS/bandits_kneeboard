// ── Pestañas fijas (siempre visibles, en orden) ───────────────────────────────
const FIXED_TABS = [];
const FIXED_TABS_END = [];

// ── Estado global ─────────────────────────────────────────────────────────────
let currentPackageTabs = [];
let allTabs = [];
let packageConfig = [];
let loadoutConfig = null;
let holdingConfig = null;
let atcConfig = null;
let tankerConfig = null;
let pageConfig = null;


// ── Carga de páginas ──────────────────────────────────────────────────────────
async function loadTab(tabId, event) {
    if (!tabId) return;

    if (event) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<p>Cargando información del waypoint...</p>';

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
        </div>`;
    }
}


// ── Persistencia de notas ─────────────────────────────────────────────────────
function initNotesSaves() {
    const textareas = document.querySelectorAll('textarea.notes-input');
    textareas.forEach(textarea => {
        if (!textarea.id) return;
        const savedText = localStorage.getItem(textarea.id);
        if (savedText) textarea.value = savedText;
        textarea.addEventListener('input', function(event) {
            localStorage.setItem(event.target.id, event.target.value);
        });
    });
}


// ── Sidebar móvil ─────────────────────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const arrow = document.querySelector('#sidebar-toggle .toggle-arrow');
    const isOpen = sidebar.classList.toggle('open');
    arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}


// ── Carga de datos ────────────────────────────────────────────────────────────
async function loadJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    return res.json();
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function toLines(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

function renderLines(lines) {
    return toLines(lines).map(line => escapeHTML(line)).join("<br>");
}

function renderPageTitle(title) {
    return `
        <div class="page-header">
            <h2>${escapeHTML(title)}</h2>
        </div>
    `;
}

function renderParagraphs(lines) {
    return toLines(lines).map(line => `<p>${escapeHTML(line)}</p>`).join("");
}

function renderCard(title, content, className = "") {
    const classes = ["card", className].filter(Boolean).join(" ");
    return `
        <div class="${classes}">
            <h3>${escapeHTML(title)}</h3>
            ${content}
        </div>
    `;
}

function renderNotesBlock(lines) {
    return `<div class="notes-input notes-display">${renderLines(lines)}</div>`;
}


const COLOR_CLASS = {
    "orange":      "bg-orange",
    "orange-dark": "bg-orange",
    "blue":        "bg-blue",
    "blue-dark":   "bg-blue",
    "purple":      "bg-purple",
    "yellow":      "bg-yellow",
    "green-light": "bg-green-light",
    "green":       "bg-green-light",
    "red":         "bg-red",
    "red-light":   "bg-red-light",
    "black":       "bg-black",
};


// ── Notas generales ───────────────────────────────────────────────────────────
async function buildGeneralNotes() {
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


// ── Armamento desde JSON ──────────────────────────────────────────────────────
async function getLoadouts() {
    if (!loadoutConfig) {
        loadoutConfig = await loadJSON("conf/loadouts.json");
    }
    return loadoutConfig;
}

async function getRadioConfig() {
    return loadJSON("conf/radios.json");
}

async function getTankerConfig() {
    if (!tankerConfig) {
        tankerConfig = await loadJSON("conf/tankers.json");
    }
    return tankerConfig;
}

async function buildArmamento(pageId) {
    const placeholder = document.getElementById('armamento-placeholder');
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
            const div = document.createElement('div');
            div.className = 'card arma-item';
            div.innerHTML = renderLoadoutItem(item);
            placeholder.appendChild(div);
        });
    } catch (err) {
        console.error('Error cargando armamento:', err);
    }
}

function renderLoadoutItem(item) {
    const brevity = item.brevity ? ` <span style="font-weight:normal">[${escapeHTML(item.brevity)}]</span>` : "";
    const nota = item.nota ? `: <span style="font-weight:normal">${escapeHTML(item.nota)}</span>` : "";
    return `<strong>${escapeHTML(item.cantidad)} ${escapeHTML(item.arma)}</strong>${brevity}${nota}`;
}


// ── Páginas configurables ────────────────────────────────────────────────────
async function getPageConfig() {
    if (!pageConfig) {
        pageConfig = await loadJSON("conf/pages.json");
    }
    return pageConfig;
}

async function getConfiguredPage(tabId) {
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

async function renderConfiguredPage(page) {
    if (page.type === "html") return loadHtmlPage(page.html || page.id);
    if (page.type === "standard") return renderStandardPage(page);
    if (page.type === "operation") return renderOperationPage(page);
    return loadHtmlPage(page.id);
}

async function loadHtmlPage(pageId) {
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


// ── Tabla de radios ───────────────────────────────────────────────────────────
async function buildRadioTable() {
    try {
        const radioConfig = await getRadioConfig();
        renderRadioGroups(radioConfig.groups);
    } catch (err) {
        console.error("Error cargando radio comms:", err);
        document.getElementById("radio-table-body").innerHTML =
            `<tr><td colspan="6" style="color:red">Error: ${escapeHTML(err.message)}</td></tr>`;
    }
}

function renderRadioGroups(groups) {
    const [primary, secondary] = groups;
    document.getElementById("radio-header-row").innerHTML = `
        <th>${escapeHTML(primary.channelHeader)}</th>
        <th>${escapeHTML(primary.agencyHeader)}</th>
        <th>${escapeHTML(primary.frequencyHeader)}</th>
        <th>${escapeHTML(secondary.channelHeader)}</th>
        <th>${escapeHTML(secondary.agencyHeader)}</th>
        <th>${escapeHTML(secondary.frequencyHeader)}</th>
    `;

    const tbody = document.getElementById("radio-table-body");
    tbody.innerHTML = "";
    const maxRows = Math.max(primary.rows.length, secondary.rows.length);

    for (let i = 0; i < maxRows; i++) {
        const a = primary.rows[i] || { radio: "", callsign: "", freq: "", color: "" };
        const b = secondary.rows[i] || { radio: "", callsign: "", freq: "", color: "" };
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHTML(a.radio)}</td>
            <td class="${COLOR_CLASS[a.color] || ""}">${escapeHTML(a.callsign)}</td>
            <td>${escapeHTML(a.freq)}</td>
            <td>${escapeHTML(b.radio)}</td>
            <td class="${COLOR_CLASS[b.color] || ""}">${escapeHTML(b.callsign)}</td>
            <td>${escapeHTML(b.freq)}</td>
        `;
        tbody.appendChild(tr);
    }
}


// ── Paquetes de vuelo ─────────────────────────────────────────────────────────
async function loadPackages() {
    return loadJSON("conf/packages.json");
}

async function buildPackageSelector() {
    try {
        packageConfig = await loadPackages();
        const select = document.getElementById("package-select");
        select.innerHTML = "";

        packageConfig.forEach(pkg => {
            const opt = document.createElement("option");
            opt.value = pkg.id;
            opt.textContent = pkg.label || pkg.id;
            select.appendChild(opt);
        });

        select.addEventListener("change", onPackageChange);

        const saved = localStorage.getItem("selectedPackage");
        const initialPackage = packageConfig.find(pkg => pkg.id === saved) || packageConfig[0];
        if (initialPackage) {
            select.value = initialPackage.id;
            applyPackage(initialPackage);
        }
    } catch (err) {
        console.error("Error cargando paquetes:", err);
    }
}

function onPackageChange(event) {
    const selectedPackage = packageConfig.find(pkg => pkg.id === event.currentTarget.value);
    if (selectedPackage) applyPackage(selectedPackage);
}

function applyPackage(selectedPackage) {
    currentPackageTabs = selectedPackage.tabs || [];
    localStorage.setItem("selectedPackage", selectedPackage.id);
    renderTabBar();
    loadFirstTab();
}

function renderTabBar() {
    const nav = document.querySelector('.tabs-nav');
    nav.innerHTML = "";

    allTabs = [
        ...FIXED_TABS,
        ...currentPackageTabs,
        ...FIXED_TABS_END,
    ];

    allTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = "tab-btn";
        btn.textContent = tab.label;
        btn.onclick = (e) => loadTab(tab.id, e);
        nav.appendChild(btn);
    });
}

function loadFirstTab() {
    const firstTab = allTabs[0];
    if (!firstTab) {
        document.getElementById('tab-content-container').innerHTML =
            "<p>Selecciona un paquete de vuelo para cargar el piernografo.</p>";
        return;
    }

    loadTab(firstTab.id, null);
    const firstBtn = document.querySelector('.tab-btn');
    if (firstBtn) firstBtn.classList.add('active');
}


// ── ATC ───────────────────────────────────────────────────────────────────────
async function getAtcConfig() {
    if (!atcConfig) {
        atcConfig = await loadJSON("conf/atc.json");
    }
    return atcConfig;
}

async function getAtcPage(tabId) {
    const config = await getAtcConfig();
    const page = config.pages?.[tabId];
    if (!page) return null;

    return {
        id: tabId,
        flights: config.flights || [],
        ...page,
    };
}

async function renderAtcPage(page) {
    if (page.id === "atc_ground") return renderAtcGround(page);
    if (page.id === "atc_overlord") return renderAtcOverlord(page);
    if (page.id === "atc_tower") return renderAtcTower(page);
    return `<h2>${escapeHTML(page.title || "ATC")}</h2>`;
}

async function renderAtcGround(page) {
    const [radioConfig, loadouts, holdings] = await Promise.all([
        getRadioConfig(),
        getLoadouts(),
        getMergedHoldings(),
    ]);
    const atisRows = getRadioRows(radioConfig)
        .filter(row => String(row.callsign || "").toUpperCase().includes("ATIS"));

    return `
        <h2>${escapeHTML(page.title)}</h2>
        ${renderImageSection("Cartas del aeropuerto", page.airportCharts)}
        ${renderAtcFlightBingos(page.flights, holdings)}
        ${renderAtisSection(page.atis || atisRows)}
        ${renderAtcLoadouts(page.flights, loadouts)}
    `;
}

async function renderAtcOverlord(page) {
    const [holdings, tankers] = await Promise.all([
        getMergedHoldings(),
        getTankerConfig(),
    ]);

    return `
        <h2>${escapeHTML(page.title)}</h2>
        ${renderTankers(tankers.tankers)}
        ${renderAtcHoldingSummary(page.flights, holdings)}
        ${renderAtcTotSummary(page.flights, holdings)}
        ${renderImageSection("Códigos de autorización", page.authCodes)}
    `;
}

async function renderAtcTower(page) {
    return `
        <h2>${escapeHTML(page.title)}</h2>
        ${renderImageSection("Cartas de departure", page.departureCharts)}
        ${renderImageSection("Cartas de ingreso a la base", page.arrivalCharts)}
    `;
}

function getRadioRows(radioConfig) {
    return (radioConfig.groups || []).flatMap(group => group.rows || []);
}

function renderImageSection(title, images) {
    if (!images?.length) return "";

    const cards = images.map(image => `
        <div class="card">
            <h4>${escapeHTML(image.title)}</h4>
            <img src="${escapeHTML(image.src)}" class="img-full atc-img">
        </div>
    `).join("");

    return `
        <div class="card">
            <h3>${escapeHTML(title)}</h3>
            <div class="atc-image-grid">${cards}</div>
        </div>
    `;
}

function renderAtisSection(atisRows) {
    if (!atisRows?.length) return "";

    const rows = atisRows.map(row => `
        <tr>
            <td>${escapeHTML(row.callsign)}</td>
            <td>${escapeHTML(row.freq)}</td>
            <td>${escapeHTML(row.notes || "")}</td>
        </tr>
    `).join("");

    return `
        <div class="card">
            <h3>ATIS</h3>
            <table class="data-table">
                <thead><tr><th>Agencia</th><th>Frecuencia</th><th>Notas</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderAtcFlightBingos(flights, holdings) {
    const rows = flights.map(flight => {
        const holding = holdings[flight.holdingId];
        return `
            <tr>
                <td>${escapeHTML(flight.label)}</td>
                <td>${escapeHTML(holding?.joker || "")}</td>
                <td>${escapeHTML(holding?.bingo || "")}</td>
            </tr>
        `;
    }).join("");

    return `
        <div class="card">
            <h3>Bingos de vuelos</h3>
            <table class="data-table">
                <thead><tr><th>Vuelo</th><th>Joker</th><th>Bingo</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderAtcLoadouts(flights, loadouts) {
    const cards = flights.map(flight => {
        const items = loadouts?.[flight.loadoutId] || [];
        const weapons = items.length
            ? items.map(item => `<li>${renderLoadoutItem(item)}</li>`).join("")
            : "<li>Sin armamento configurado</li>";

        return `
            <div class="card">
                <h4>${escapeHTML(flight.label)}</h4>
                <ul>${weapons}</ul>
            </div>
        `;
    }).join("");

    return `
        <div class="card">
            <h3>Armamento</h3>
            <div class="data-grid">${cards}</div>
        </div>
    `;
}

function renderTankers(tankers) {
    if (!tankers?.length) return "";

    const cards = tankers.map(tanker => `
        <div class="card">
            <strong>${escapeHTML(tanker.callsign)}</strong>
            <p>Frecuencia: ${escapeHTML(tanker.freq)}</p>
            <p>TACAN: ${escapeHTML(tanker.tacan)}</p>
            <p>Altitud: ${escapeHTML(tanker.altitude || "")}</p>
        </div>
    `).join("");

    return `
        <div class="card">
            <h3>Tankers</h3>
            <div class="data-grid">${cards}</div>
        </div>
    `;
}

function renderAtcHoldingSummary(flights, holdings) {
    const rows = flights.map(flight => {
        const data = holdings[flight.holdingId];
        return `
            <tr>
                <td>${escapeHTML(flight.label)}</td>
                <td>${escapeHTML(data?.holding?.point || "")}</td>
                <td>${escapeHTML(data?.holding?.altitude || "")}</td>
            </tr>
        `;
    }).join("");

    return `
        <div class="card">
            <h3>Puntos de espera</h3>
            <table class="data-table">
                <thead><tr><th>Vuelo</th><th>Punto</th><th>Altitud</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderAtcTotSummary(flights, holdings) {
    const rows = flights.map(flight => {
        const data = holdings[flight.holdingId];
        return `
            <tr>
                <td>${escapeHTML(flight.label)}</td>
                <td>${escapeHTML(data?.tot?.description || "")}</td>
                <td>${escapeHTML(data?.tot?.pushPoint || "")}</td>
                <td>${escapeHTML(data?.bingo || "")}</td>
            </tr>
        `;
    }).join("");

    return `
        <div class="card">
            <h3>TOT y Bingo</h3>
            <table class="data-table">
                <thead><tr><th>Vuelo</th><th>TOT</th><th>Push</th><th>Bingo</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

async function getMergedHoldings() {
    if (!holdingConfig) {
        holdingConfig = await loadJSON("conf/holdings.json");
    }

    return Object.fromEntries(
        Object.entries(holdingConfig.items || {}).map(([id, item]) => [
            id,
            { ...holdingConfig.defaults, ...item },
        ])
    );
}


// ── Tankers ───────────────────────────────────────────────────────────────────
async function getTankerPage(tabId) {
    if (tabId !== "3_tanker") return null;
    return getTankerConfig();
}

function renderTankerPage(data) {
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


// ── Puntos de espera ──────────────────────────────────────────────────────────
async function getHolding(tabId) {
    if (!holdingConfig) {
        holdingConfig = await loadJSON("conf/holdings.json");
    }
    const item = holdingConfig.items?.[tabId];
    if (!item) return null;

    return {
        ...holdingConfig.defaults,
        ...item,
    };
}

function renderHolding(data) {
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


// ── Inicialización ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        buildRadioTable(),
        buildGeneralNotes(),
    ]);
    initNotesSaves();
    await buildPackageSelector();
});
