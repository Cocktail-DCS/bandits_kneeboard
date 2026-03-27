// Archivo: app.js

// Función para cargar el contenido HTML dinámicamente
async function loadTab(tabId, event) {
    // 1. Actualizar el estado visual de los botones
    if (event) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const container = document.getElementById('tab-content-container');
    
    // Opcional: Mostrar un mensaje de carga mientras busca el archivo
    container.innerHTML = '<p>Cargando información del waypoint...</p>';

    try {
        // 2. Hacer la petición para obtener el archivo HTML (ej. "wp1.html")
        // Si pusiste los archivos en una carpeta, cambia esto a: `waypoints/${tabId}.html`
        const response = await fetch(`${tabId}.html`);
        
        // Comprobar si el archivo existe
        if (!response.ok) {
            throw new Error(`No se pudo cargar ${tabId}.html`);
        }

        // 3. Extraer el texto HTML
        const html = await response.text();
        
        // 4. Inyectar el HTML en el contenedor principal
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

// Función para inicializar y guardar el estado de los cuadros de texto
function initNotesSaves() {
    // Buscamos todos los textareas que tengan la clase 'notes-input'
    const textareas = document.querySelectorAll('.notes-input');

    textareas.forEach(textarea => {
        // 1. CARGAR: Al iniciar, comprobamos si ya hay algo guardado para este ID
        const savedText = localStorage.getItem(textarea.id);
        if (savedText) {
            textarea.value = savedText;
        }

        // 2. GUARDAR: Cada vez que el usuario escriba algo, lo guardamos automáticamente
        textarea.addEventListener('input', function(event) {
            // Guardamos el texto usando el ID del textarea como "llave"
            localStorage.setItem(event.target.id, event.target.value);
        });
    });
}

// Añadir en app.js o en un <script> al final del body
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const arrow = document.querySelector('#sidebar-toggle .toggle-arrow');
    const isOpen = sidebar.classList.toggle('open');
    arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

// Cargar la primera pestaña (WP0) por defecto cuando se abre la página
window.addEventListener('DOMContentLoaded', () => {
    loadTab('startup_taxi', null);
});