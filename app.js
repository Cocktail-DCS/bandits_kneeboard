// Carga de paginas de la misión

async function loadTab(tabId, event) {
    if (event) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const container = document.getElementById('tab-content-container');
    
    container.innerHTML = '<p>Cargando información del waypoint...</p>';

    try {
        const response = await fetch(`${tabId}.html`);
        
        if (!response.ok) {
            throw new Error(`No se pudo cargar ${tabId}.html`);
        }

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


// Persistencia

function initNotesSaves() {
    const textareas = document.querySelectorAll('.notes-input');

    textareas.forEach(textarea => {
        const savedText = localStorage.getItem(textarea.id);
        if (savedText) {
            textarea.value = savedText;
        }
        textarea.addEventListener('input', function(event) {
            localStorage.setItem(event.target.id, event.target.value);
        });
    });
}


// Manejo de la barra lateral para moviles

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const arrow = document.querySelector('#sidebar-toggle .toggle-arrow');
    const isOpen = sidebar.classList.toggle('open');
    arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}


// Carga de radios desde CSV

const COLOR_CLASS = {
            "orange":       "bg-orange",
            "orange-dark":  "bg-orange",
            "blue":         "bg-blue",
            "blue-dark":    "bg-blue",
            "purple":       "bg-purple",
            "yellow":       "bg-yellow",
            "green-light":  "bg-green-light",
            "green":        "bg-green-light",
        };

        function parseCSV(text) {
            const lines = text.trim().split("\n");
            const headers = lines[0].split(",").map(h => h.trim());
            return lines.slice(1).map(line => {
                const cols = [];
                let cur = "", inQ = false;
                for (const ch of line) {
                    if (ch === '"') { inQ = !inQ; }
                    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
                    else { cur += ch; }
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
 
        // ── Construye la tabla combinando las dos radios ──────────────────────
        async function buildRadioTable() {
            try {
                const [r1, r2] = await Promise.all([
                    loadCSV("radio/radio_comms.csv"),       // Radio 1 – BORODINO
                    loadCSV("radio/radio_comms_2.csv"),      // Radio 2 – LEIPZIG
                ]);
 
                const headerRow = document.getElementById("radio-header-row");
                headerRow.innerHTML = `
                    <th>1</th><th>AGCY(BORODINO)</th><th>FREQ</th>
                    <th>2</th><th>AGCY(LEIPZIG)</th><th>FREQ</th>
                `;
 
                const tbody = document.getElementById("radio-table-body");
                const maxRows = Math.max(r1.length, r2.length);
 
                for (let i = 0; i < maxRows; i++) {
                    const a = r1[i]  || { radio: "", callsign: "", freq: "", color: "" };
                    const b = r2[i]  || { radio: "", callsign: "", freq: "", color: "" };
 
                    const clsA = COLOR_CLASS[a.color] || "";
                    const clsB = COLOR_CLASS[b.color] || "";
 
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${a.radio}</td>
                        <td class="${clsA}">${a.callsign}</td>
                        <td>${a.freq}</td>
                        <td>${b.radio}</td>
                        <td class="${clsB}">${b.callsign}</td>
                        <td>${b.freq}</td>
                    `;
                    tbody.appendChild(tr);
                }
            } catch (err) {
                console.error("Error cargando radio comms CSV:", err);
                document.getElementById("radio-table-body").innerHTML =
                    `<tr><td colspan="6" style="color:red">Error al cargar los datos: ${err.message}</td></tr>`;
            }
        }

// Cargar la primera pestaña (WP0) por defecto cuando se abre la página
window.addEventListener('DOMContentLoaded', () => {
    buildRadioTable();
    loadTab('startup_taxi', null);
});