export const EDITOR_CONF_FILES = [
    "atc.json",
    "holdings.json",
    "loadouts.json",
    "notes.json",
    "packages.json",
    "pages.json",
    "radios.json",
    "tankers.json",
];

export const EDITOR_HTML_FILES = [
    "1_startup_taxi_ground.html",
    "1_startup_taxi_carrier.html",
    "2_departures.html",
    "3_tanker.html",
    "8_arrivals_ground.html",
    "8_arrivals_carrier.html",
    "9_shutdown_taxi_ground.html",
    "9_shutdown_taxi_carrier.html",
];

export const HTML_BLOCK_TYPES = {
    card: "Tarjeta",
    notes: "Comunicaciones",
    checklist: "Checklist",
    list: "Lista",
    image: "Imagen",
    textarea: "Notas editables",
    raw: "HTML crudo",
};

export const EDITOR_IMAGE_FILES = [
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

export const EDITOR_RADIO_COLOR_OPTIONS = [
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

export const editorState = {
    enabled: false,
    conf: {},
    pages: {},
    htmlDocs: {},
    activeConfFile: EDITOR_CONF_FILES[0],
    activeHtmlFile: EDITOR_HTML_FILES[0],
    activeImageInput: null,
};
