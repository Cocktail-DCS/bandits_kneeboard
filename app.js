// ── Pestañas fijas (siempre visibles, en orden) ───────────────────────────────
const FIXED_TABS = [];
const FIXED_TABS_END = [];

// ── Estado global ─────────────────────────────────────────────────────────────
let currentPackageTabs = [];
let allTabs = [];
let packageConfig = [];
let loadoutConfig = null;
let holdingConfig = null;


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
        const holding = await getHolding(tabId);
        if (holding) {
            container.innerHTML = renderHolding(holding);
            initNotesSaves();
            return;
        }

        const response = await fetch(`pages/${tabId}.html`);
        if (!response.ok) throw new Error(`No se pudo cargar ${tabId}.html`);

        container.innerHTML = await response.text();
        initNotesSaves();
        await buildArmamento(tabId);
    } catch (error) {
        console.error("Error cargando la pestaña:", error);
        container.innerHTML = `<div style="color: red; padding: 20px;">
            <h3>Error</h3>
            <p>No se encontró el archivo de este waypoint.</p>
        </div>`;
    }
}


// ── Persistencia de notas ─────────────────────────────────────────────────────
function initNotesSaves() {
    const textareas = document.querySelectorAll('textarea.notes-input');
    textareas.forEach(textarea => {
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

function renderLines(lines) {
    return (lines || []).map(line => escapeHTML(line)).join("<br>");
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

    card.innerHTML = `
        <h3>NOTAS GENERALES</h3>
        <strong>Soft Deck: ${escapeHTML(notes.softDeck)}</strong>
        <br>
        <strong>Hard Deck: ${escapeHTML(notes.hardDeck)}</strong>
        <br>
        <br>
        <textarea id="notes-general" class="notes-input" style="min-height: 100px;" placeholder="${escapeHTML(notes.placeholder)}"></textarea>
        <br>
        <br>
    `;
}


// ── Armamento desde JSON ──────────────────────────────────────────────────────
async function getLoadouts() {
    if (!loadoutConfig) {
        loadoutConfig = await loadJSON("conf/loadouts.json");
    }
    return loadoutConfig;
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
            const nota = item.nota ? `: <span style="font-weight:normal">${escapeHTML(item.nota)}</span>` : '';
            div.innerHTML = `<strong>${escapeHTML(item.cantidad)} ${escapeHTML(item.arma)}</strong>${nota}`;
            placeholder.appendChild(div);
        });
    } catch (err) {
        console.error('Error cargando armamento:', err);
    }
}


// ── Tabla de radios ───────────────────────────────────────────────────────────
async function buildRadioTable() {
    try {
        const radioConfig = await loadJSON("conf/radios.json");
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
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2>${escapeHTML(data.title || "Holding")}</h2>
        </div>

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
            <div class="notes-input" style="min-height: auto;">
                ${renderLines(data.arrival)}
            </div>
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
