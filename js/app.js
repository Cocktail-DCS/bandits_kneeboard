import { buildGeneralNotes, initNotesSaves } from "./app/notes.js";
import { buildPackageSelector } from "./app/packages.js";
import { buildRadioTable } from "./app/renderers/radio.js";
import { initSidebarToggle } from "./app/sidebar.js";

window.addEventListener("DOMContentLoaded", async () => {
    initSidebarToggle();
    await Promise.all([
        buildRadioTable(),
        buildGeneralNotes(),
    ]);
    initNotesSaves();
    await buildPackageSelector();
});
