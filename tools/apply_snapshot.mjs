#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SNAPSHOT_VERSION = 1;
const ROOT = process.cwd();
const CONF_DIR = path.join(ROOT, "conf");
const PAGES_DIR = path.join(ROOT, "pages");
const BACKUP_DIR = path.join(ROOT, "backups");

async function main() {
    const snapshotPath = process.argv[2];
    if (!snapshotPath) {
        throw new Error("Uso: node tools/apply_snapshot.mjs kneeboard-snapshot.json");
    }

    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    validateSnapshot(snapshot);
    const backup = process.argv.includes("--backup");
    const backupRoot = backup
        ? path.join(BACKUP_DIR, `snapshot-${new Date().toISOString().slice(0, 19).replaceAll(":", "")}`)
        : null;

    await mkdir(CONF_DIR, { recursive: true });
    await mkdir(PAGES_DIR, { recursive: true });
    if (backupRoot) await mkdir(backupRoot, { recursive: true });

    const changed = [];

    for (const [file, value] of Object.entries(snapshot.conf || {})) {
        validateFileName(file, ".json");
        const target = safeJoin(CONF_DIR, file);
        JSON.stringify(value);
        if (backupRoot) await backupExisting(target, path.join(backupRoot, "conf", file));
        await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
        changed.push(`conf/${file}`);
    }

    for (const [file, value] of Object.entries(snapshot.pages || {})) {
        validateFileName(file, ".html");
        if (typeof value !== "string") {
            throw new Error(`pages/${file} debe ser una cadena HTML`);
        }
        const target = safeJoin(PAGES_DIR, file);
        if (backupRoot) await backupExisting(target, path.join(backupRoot, "pages", file));
        await writeFile(target, `${value.trim()}\n`, "utf8");
        changed.push(`pages/${file}`);
    }

    console.log(`Snapshot aplicado. ${changed.length} archivo(s) escritos:`);
    if (backupRoot) console.log(`Backup previo: ${path.relative(ROOT, backupRoot)}`);
    changed.forEach(file => console.log(`- ${file}`));
}

async function backupExisting(source, target) {
    try {
        const content = await readFile(source);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
        throw new Error("El snapshot debe ser un objeto JSON");
    }

    if (snapshot.version !== SNAPSHOT_VERSION) {
        throw new Error(`Version de snapshot no soportada: ${snapshot.version}`);
    }

    if (snapshot.source !== "bandits-kneeboard-editor") {
        throw new Error("El snapshot no parece generado por el editor del kneeboard");
    }

    if (!snapshot.conf || typeof snapshot.conf !== "object") {
        throw new Error("El snapshot no contiene bloque conf");
    }

    if (!snapshot.pages || typeof snapshot.pages !== "object") {
        throw new Error("El snapshot no contiene bloque pages");
    }
}

function validateFileName(file, extension) {
    if (typeof file !== "string" || !file.endsWith(extension)) {
        throw new Error(`Nombre de archivo invalido: ${file}`);
    }

    if (file.includes("/") || file.includes("\\") || file.includes("..") || path.isAbsolute(file)) {
        throw new Error(`Ruta no permitida: ${file}`);
    }
}

function safeJoin(base, file) {
    const target = path.resolve(base, file);
    const relative = path.relative(base, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Ruta fuera del directorio permitido: ${file}`);
    }
    return target;
}

main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});
