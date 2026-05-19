import { COLOR_CLASS, escapeHTML } from "../../shared/html.js";
import { getRadioConfig } from "../data.js";

export async function buildRadioTable() {
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
