// scripts/alpine-setup.js
// This file is processed by Astro/Vite during build

// Global Alpine stores for app state
document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    sidebarOpen: false, // For mobile sidebar, if controlled via global store
    // darkMode and toggleDarkMode removed as theme is now OS-preference only
    // and not user-toggleable through this store.

    toggleSidebar() {
      // This might be used if the AppLayout's mobile toggle directly manipulates this store,
      // OR if Sidebar.astro itself uses this store for its mobileOpen state.
      // Currently, Sidebar.astro listens for a window event.
      // Keeping this structure in case a global store for sidebar is desired.
      this.sidebarOpen = !this.sidebarOpen;
    }
  });

  // Financial data stores (remains unchanged)
  Alpine.store('financial', {
    currentEntity: null,
    currentPeriod: 'month',
    currency: 'USD'
  });
});

// The actual Alpine import and plugin registration
// should be handled by Astro's Alpine integration via astro.config.mjs