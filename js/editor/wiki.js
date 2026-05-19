export function renderEditorWiki() {
    const content = document.getElementById("editor-content");
    content.innerHTML = `
        <article class="editor-wiki">
            <aside class="editor-wiki-nav">
                <a href="#wiki-flujo">Flujo</a>
                <a href="#wiki-resolucion">Orden de carga</a>
                <a href="#wiki-ids">IDs</a>
                <a href="#wiki-config">Configuraciones</a>
                <a href="#wiki-crear-vuelo">Crear vuelo</a>
                <a href="#wiki-operacion">Operación STRIKE</a>
                <a href="#wiki-espera">Esperas</a>
                <a href="#wiki-atc">ATC</a>
                <a href="#wiki-html">HTML</a>
                <a href="#wiki-imagenes">Imágenes</a>
                <a href="#wiki-exportar">Exportar</a>
                <a href="#wiki-problemas">Problemas</a>
            </aside>
            <div class="editor-wiki-content">
                <header class="editor-wiki-hero">
                    <h3>Wiki del editor</h3>
                    <p>Referencia para montar una misión, entender qué controla cada archivo y decidir dónde editar cada tipo de contenido.</p>
                    <p><strong>Importante:</strong> entrar en esta wiki no recarga la página. Los cambios hechos en JSON o HTML se sincronizan en memoria al cambiar de pestaña y seguirán disponibles para exportar.</p>
                </header>

                <section id="wiki-flujo">
                    <h4>Flujo recomendado para crear una misión</h4>
                    <ol>
                        <li><strong>Define radios</strong> en <code>radios.json</code>: agencias, canales, frecuencias y colores.</li>
                        <li><strong>Define tankers</strong> en <code>tankers.json</code>: se usan en Repostaje y en ATC Overlord.</li>
                        <li><strong>Define esperas</strong> en <code>holdings.json</code>: punto, altitud, Joker, Bingo, TOT y procedimientos.</li>
                        <li><strong>Define armamento</strong> en <code>loadouts.json</code>: una entrada por página de operación.</li>
                        <li><strong>Define páginas generadas</strong> en <code>pages.json</code>: operaciones STRIKE, plantillas reutilizables o páginas estándar.</li>
                        <li><strong>Define paquetes</strong> en <code>packages.json</code>: cada paquete decide qué pestañas verá el piloto.</li>
                        <li><strong>Revisa ATC</strong> en <code>atc.json</code>: cartas, ATIS y códigos de autorización.</li>
                        <li><strong>Exporta el snapshot</strong> y aplícalo en el repo con el script local.</li>
                    </ol>
                </section>

                <section id="wiki-resolucion">
                    <h4>Orden de carga de una pestaña</h4>
                    <p>Cuando un piloto pulsa una pestaña, la app busca el contenido en este orden:</p>
                    <ol>
                        <li><code>atc.json</code>: si el id existe en <code>pages</code>, se renderiza como pantalla ATC.</li>
                        <li><code>holdings.json</code>: si el id existe en <code>items</code>, se renderiza como espera.</li>
                        <li><code>3_tanker</code>: se renderiza desde <code>tankers.json</code>.</li>
                        <li><code>pages.json</code>: si el id existe en <code>pages</code>, se renderiza desde datos o plantilla.</li>
                        <li><code>pages/{id}.html</code>: fallback para HTML personalizado.</li>
                    </ol>
                </section>

                <section id="wiki-ids">
                    <h4>IDs y nombres</h4>
                    <p>El <code>id</code> de una pestaña en <code>packages.json</code> es la clave que conecta toda la app. Debe coincidir con una página ATC, una espera, una página de <code>pages.json</code> o un archivo HTML sin extensión.</p>
                    <table class="data-table">
                        <thead><tr><th>Tipo</th><th>Ejemplo</th><th>Dónde vive</th></tr></thead>
                        <tbody>
                            <tr><td>ATC</td><td><code>atc_ground</code></td><td><code>atc.json.pages</code></td></tr>
                            <tr><td>Espera</td><td><code>holding_push_raccoon1</code></td><td><code>holdings.json.items</code></td></tr>
                            <tr><td>Operación</td><td><code>op_raccoon1</code></td><td><code>pages.json.pages</code> y <code>loadouts.json</code></td></tr>
                            <tr><td>HTML</td><td><code>2_departures</code></td><td><code>pages/2_departures.html</code></td></tr>
                        </tbody>
                    </table>
                </section>

                <section id="wiki-config">
                    <h4>Qué edita cada JSON</h4>
                    <dl>
                        <dt><code>packages.json</code></dt><dd>Lista de paquetes y pestañas visibles para cada paquete.</dd>
                        <dt><code>radios.json</code></dt><dd>Tabla lateral de radios.</dd>
                        <dt><code>notes.json</code></dt><dd>Notas generales, soft deck, hard deck e imagen opcional.</dd>
                        <dt><code>tankers.json</code></dt><dd>Página Repostaje y resumen ATC Overlord.</dd>
                        <dt><code>holdings.json</code></dt><dd>Esperas por vuelo con valores comunes en <code>defaults</code>.</dd>
                        <dt><code>loadouts.json</code></dt><dd>Armamento por id de página de operación.</dd>
                        <dt><code>pages.json</code></dt><dd>Páginas renderizadas desde datos y plantillas.</dd>
                        <dt><code>atc.json</code></dt><dd>Pantallas Ground, Tower y Overlord.</dd>
                    </dl>
                </section>

                <section id="wiki-crear-vuelo">
                    <h4>Crear un vuelo nuevo</h4>
                    <ol>
                        <li>Añade un paquete en <code>packages.json</code> con id, label y pestañas.</li>
                        <li>Crea su espera en <code>holdings.json.items</code>.</li>
                        <li>Crea su operación en <code>pages.json.pages</code>.</li>
                        <li>Añade armamento en <code>loadouts.json</code> usando el mismo id de operación.</li>
                        <li>Vuelve a la app principal y selecciona el paquete.</li>
                    </ol>
                </section>

                <section id="wiki-operacion">
                    <h4>Página de operación STRIKE</h4>
                    <p>Usa <code>type: "operation"</code> para páginas con situación, FENCE-IN, importante, objetivos, armamento y regreso. El armamento se toma de <code>loadouts.json</code> usando el mismo id de la página.</p>
                </section>

                <section id="wiki-espera">
                    <h4>Esperas</h4>
                    <p><code>holdings.json.defaults</code> contiene textos compartidos. Cada entrada de <code>items</code> puede sobrescribir solo lo que cambie para ese vuelo.</p>
                </section>

                <section id="wiki-atc">
                    <h4>ATC</h4>
                    <p>Las pantallas ATC derivan vuelos desde <code>packages.json</code>, esperas desde <code>holdings.json</code>, tankers desde <code>tankers.json</code> y armamento desde <code>loadouts.json</code>.</p>
                </section>

                <section id="wiki-html">
                    <h4>HTML personalizado</h4>
                    <p>La pestaña HTML edita archivos dentro de <code>pages/</code>. Úsala para contenido muy específico, maquetaciones raras o páginas que no encajan bien en <code>pages.json</code>.</p>
                    <table class="data-table">
                        <thead><tr><th>Bloque</th><th>Uso</th></tr></thead>
                        <tbody>
                            <tr><td>Tarjeta</td><td>Sección con título y párrafo.</td></tr>
                            <tr><td>Comunicaciones</td><td>Texto preformateado estilo notas.</td></tr>
                            <tr><td>Checklist</td><td>Lista de comprobación.</td></tr>
                            <tr><td>Imagen</td><td>Carta, mapa o referencia visual.</td></tr>
                            <tr><td>HTML crudo</td><td>Casos especiales.</td></tr>
                        </tbody>
                    </table>
                </section>

                <section id="wiki-imagenes">
                    <h4>Imágenes</h4>
                    <p>Las rutas son relativas a <code>index.html</code>. Usa la biblioteca lateral para copiar o insertar rutas existentes.</p>
                </section>

                <section id="wiki-exportar">
                    <h4>Exportar y aplicar</h4>
                    <p>El navegador descarga un snapshot. Para aplicarlo en el repo, ejecuta:</p>
                    <pre><code>node tools/apply_snapshot.mjs kneeboard-snapshot.json --backup</code></pre>
                </section>

                <section id="wiki-problemas">
                    <h4>Problemas comunes</h4>
                    <dl>
                        <dt>ID no encontrado</dt><dd>La pestaña apunta a un id que no existe en ATC, holdings, pages.json ni pages/.</dd>
                        <dt>No aparece armamento</dt><dd>El id de operación no tiene entrada en <code>loadouts.json</code>.</dd>
                        <dt>Imagen rota</dt><dd>La ruta no existe o tiene mayúsculas, espacios o acentos distintos al archivo real.</dd>
                    </dl>
                </section>
            </div>
        </article>
    `;
}
