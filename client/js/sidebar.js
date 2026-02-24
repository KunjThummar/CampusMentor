// ===== SIDEBAR MANAGEMENT =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// SPA Navigation — show/hide page sections
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-section]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.getAttribute('data-section');
      navigateTo(section);
      // Close sidebar on mobile
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    });
  });
}

function navigateTo(section) {
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Show correct section
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`section-${section}`);
  if (target) {
    target.classList.add('active');
    // Update page title
    const title = activeNav?.getAttribute('data-title') || section;
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = title;
  }

  // Trigger section load
  document.dispatchEvent(new CustomEvent('sectionChanged', { detail: { section } }));
}
