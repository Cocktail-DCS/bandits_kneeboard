// ── Pestañas fijas (siempre visibles, en orden) ───────────────────────────────
const FIXED_TABS = [
    { id: "startup_taxi", label: "En tierra - Inicio" },
    { id: "departures", label: "Salida" },
    { id: "tanker",       label: "Repostaje"          },
];

const FIXED_TABS_END = [
    { id: "arrivals", label: "Llegadas" },
    { id: "shutdown_taxi", label: "En tierra - Fin" },
];

// ── Estado global ─────────────────────────────────────────────────────────────
let currentPackageTabs = [];


// ── Carga de páginas ──────────────────────────────────────────────────────────
async function loadTab(tabId, event) {
    if (event) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<p>Cargando información del waypoint...</p>';

    try {
        const response = await fetch(`pages/${tabId}.html`);
        if (!response.ok) throw new Error(`No se pudo cargar ${tabId}.html`);

        const html = await response.text();
        container.innerHTML = html;
        initNotesSaves();
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
    const textareas = document.querySelectorAll('.notes-input');
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


// ── CSV helpers ───────────────────────────────────────────────────────────────
const COLOR_CLASS = {
    "orange":      "bg-orange",
    "orange-dark": "bg-orange",
    "blue":        "bg-blue",
    "blue-dark":   "bg-blue",
    "purple":      "bg-purple",
    "yellow":      "bg-yellow",
    "green-light": "bg-green-light",
    "green":       "bg-green-light",
};

function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
        const cols = [];
        let cur = "", inQ = false;
        for (const ch of line) {
            if (ch === '"')          { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
            else                     { cur += ch; }
        }
        cols.push(cur.trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = cols[i] ?? "");
        return obj;
    });
}

async function loadCSV(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    return parseCSV(await res.text());
}


// ── Tabla de radios ───────────────────────────────────────────────────────────
async function buildRadioTable() {
    try {
        const [r1, r2] = await Promise.all([
            loadCSV("radios/radio_comms.csv"),
            loadCSV("radios/radio_comms_2.csv"),
        ]);

        document.getElementById("radio-header-row").innerHTML = `
            <th>1</th><th>AGCY(BORODINO)</th><th>FREQ</th>
            <th>2</th><th>AGCY(LEIPZIG)</th><th>FREQ</th>
        `;

        const tbody = document.getElementById("radio-table-body");
        const maxRows = Math.max(r1.length, r2.length);

        for (let i = 0; i < maxRows; i++) {
            const a = r1[i] || { radio: "", callsign: "", freq: "", color: "" };
            const b = r2[i] || { radio: "", callsign: "", freq: "", color: "" };
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${a.radio}</td>
                <td class="${COLOR_CLASS[a.color] || ""}">${a.callsign}</td>
                <td>${a.freq}</td>
                <td>${b.radio}</td>
                <td class="${COLOR_CLASS[b.color] || ""}">${b.callsign}</td>
                <td>${b.freq}</td>
            `;
            tbody.appendChild(tr);
        }
    } catch (err) {
        console.error("Error cargando radio comms CSV:", err);
        document.getElementById("radio-table-body").innerHTML =
            `<tr><td colspan="6" style="color:red">Error: ${err.message}</td></tr>`;
    }
}


// ── Paquetes de vuelo ─────────────────────────────────────────────────────────

function parsePackageTabs(tabsStr) {
    if (!tabsStr) return [];
    return tabsStr.split(";").map(entry => {
        const [id, label] = entry.split("|");
        return { id: id.trim(), label: (label || id).trim() };
    });
}

async function buildPackageSelector() {
    try {
        const packages = await loadCSV("packages/packages.csv");
        const select = document.getElementById("package-select");

        // Opción vacía inicial
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "— Selecciona paquete —";
        select.appendChild(placeholder);

        packages.forEach(pkg => {
            const opt = document.createElement("option");
            opt.value = pkg.package;
            opt.textContent = pkg.label || pkg.package;
            // Guardamos las pestañas como data attribute serializado
            opt.dataset.tabs = pkg.tabs;
            select.appendChild(opt);
        });

        select.addEventListener("change", onPackageChange);

        // Restaurar paquete guardado
        const saved = localStorage.getItem("selectedPackage");
        if (saved) {
            select.value = saved;
            if (select.value === saved) {
                // Dispara el cambio para reconstruir pestañas
                select.dispatchEvent(new Event("change"));
            }
        }
    } catch (err) {
        console.error("Error cargando packages.csv:", err);
    }
}


function onPackageChange(event) {
    const select = event.currentTarget;
    const selectedOpt = select.options[select.selectedIndex];
    const tabsStr = selectedOpt.dataset.tabs || "";
    currentPackageTabs = parsePackageTabs(tabsStr);

    localStorage.setItem("selectedPackage", select.value);

    renderTabBar();
    loadTab(FIXED_TABS[0].id, null);
    const firstBtn = document.querySelector('.tab-btn');
    if (firstBtn) firstBtn.classList.add('active');
}

function renderTabBar() {
    const nav = document.querySelector('.tabs-nav');
    nav.innerHTML = "";

    const allTabs = [
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


// ── Inicialización ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    buildRadioTable();
    buildPackageSelector();

    // Renderiza la barra sin pestañas variables (ningún paquete seleccionado aún)
    renderTabBar();

    // Carga la primera pestaña fija por defecto
    loadTab(FIXED_TABS[0].id, null);
    const firstBtn = document.querySelector('.tab-btn');
    if (firstBtn) firstBtn.classList.add('active');
});