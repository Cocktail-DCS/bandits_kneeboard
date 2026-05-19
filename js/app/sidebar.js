export function initSidebarToggle() {
    document.getElementById("sidebar-toggle")?.addEventListener("click", toggleSidebar);
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const arrow = document.querySelector("#sidebar-toggle .toggle-arrow");
    const isOpen = sidebar.classList.toggle("open");
    arrow.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
}
