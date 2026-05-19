import { escapeHTML } from "../../shared/html.js";
import {
    getAtcConfig,
    getLoadouts,
    getMergedHoldings,
    getRadioConfig,
    getTankerConfig,
    loadPackages,
} from "../data.js";
import { renderLoadoutItem } from "./loadouts.js";

export async function getAtcPage(tabId) {
    const config = await getAtcConfig();
    const page = config.pages?.[tabId];
    if (!page) return null;

    return {
        id: tabId,
        flights: await getAtcFlights(config),
        ...page,
    };
}

async function getAtcFlights(config) {
    const [packages, holdings, loadouts] = await Promise.all([
        loadPackages(),
        getMergedHoldings(),
        getLoadouts(),
    ]);

    const loadoutIds = new Set(
        Object.entries(loadouts || {})
            .filter(([, value]) => Array.isArray(value))
            .map(([id]) => id)
    );

    const derivedFlights = (packages || [])
        .filter(pkg => pkg.id !== "ATC")
        .map(pkg => {
            const tabs = pkg.tabs || [];
            const holdingTab = tabs.find(tab => holdings[tab.id]);
            const loadoutTab = tabs.find(tab => loadoutIds.has(tab.id));
            return {
                label: pkg.label || pkg.id,
                holdingId: holdingTab?.id || "",
                loadoutId: loadoutTab?.id || "",
            };
        });

    return derivedFlights.length ? derivedFlights : config.flights || [];
}

export async function renderAtcPage(page) {
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
