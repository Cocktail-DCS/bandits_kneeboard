import { appState, FIXED_TABS, FIXED_TABS_END } from "./state.js";
import { loadPackages } from "./data.js";
import { loadTab } from "./tabs.js";

export async function buildPackageSelector() {
    try {
        appState.packageConfig = await loadPackages();
        const select = document.getElementById("package-select");
        select.innerHTML = "";

        appState.packageConfig.forEach(pkg => {
            const opt = document.createElement("option");
            opt.value = pkg.id;
            opt.textContent = pkg.label || pkg.id;
            select.appendChild(opt);
        });

        select.addEventListener("change", onPackageChange);

        const saved = localStorage.getItem("selectedPackage");
        const initialPackage = appState.packageConfig.find(pkg => pkg.id === saved) || appState.packageConfig[0];
        if (initialPackage) {
            select.value = initialPackage.id;
            applyPackage(initialPackage);
        }
    } catch (err) {
        console.error("Error cargando paquetes:", err);
    }
}

function onPackageChange(event) {
    const selectedPackage = appState.packageConfig.find(pkg => pkg.id === event.currentTarget.value);
    if (selectedPackage) applyPackage(selectedPackage);
}

function applyPackage(selectedPackage) {
    appState.currentPackageTabs = selectedPackage.tabs || [];
    localStorage.setItem("selectedPackage", selectedPackage.id);
    renderTabBar();
    loadFirstTab();
}

function renderTabBar() {
    const nav = document.querySelector(".tabs-nav");
    nav.innerHTML = "";

    appState.allTabs = [
        ...FIXED_TABS,
        ...appState.currentPackageTabs,
        ...FIXED_TABS_END,
    ];

    appState.allTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = "tab-btn";
        btn.textContent = tab.label;
        btn.addEventListener("click", event => loadTab(tab.id, event));
        nav.appendChild(btn);
    });
}

function loadFirstTab() {
    const firstTab = appState.allTabs[0];
    if (!firstTab) {
        document.getElementById("tab-content-container").innerHTML =
            "<p>Selecciona un paquete de vuelo para cargar el piernografo.</p>";
        return;
    }

    loadTab(firstTab.id, null);
    const firstBtn = document.querySelector(".tab-btn");
    if (firstBtn) firstBtn.classList.add("active");
}
