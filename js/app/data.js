import { loadJSON } from "../shared/html.js";
import { appState } from "./state.js";

export async function getLoadouts() {
    if (!appState.loadoutConfig) {
        appState.loadoutConfig = await loadJSON("conf/loadouts.json");
    }
    return appState.loadoutConfig;
}

export async function getRadioConfig() {
    return loadJSON("conf/radios.json");
}

export async function getTankerConfig() {
    if (!appState.tankerConfig) {
        appState.tankerConfig = await loadJSON("conf/tankers.json");
    }
    return appState.tankerConfig;
}

export async function loadPackages() {
    return loadJSON("conf/packages.json");
}

export async function getAtcConfig() {
    if (!appState.atcConfig) {
        appState.atcConfig = await loadJSON("conf/atc.json");
    }
    return appState.atcConfig;
}

export async function getPageConfig() {
    if (!appState.pageConfig) {
        appState.pageConfig = await loadJSON("conf/pages.json");
    }
    return appState.pageConfig;
}

export async function getMergedHoldings() {
    if (!appState.holdingConfig) {
        appState.holdingConfig = await loadJSON("conf/holdings.json");
    }

    return Object.fromEntries(
        Object.entries(appState.holdingConfig.items || {}).map(([id, item]) => [
            id,
            { ...appState.holdingConfig.defaults, ...item },
        ])
    );
}
