document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // SIDEBAR VISIBILITY TOGGLE FUNCTIONALITY
  // ======================================================

  // Get sidebar and toggle button elements
  const sidebar = document.getElementById("sidebar");
  const hide_menu = document.getElementById("hide-menu");
  const show_menu = document.getElementById("show-menu");
  const mainContent = document.getElementById("mainContentDiv");
  const overlay = document.createElement("div");

  // Create overlay for small screens
  overlay.classList.add("fixed", "inset-0", "bg-black/70", "z-10", "hidden");
  document.body.appendChild(overlay);

  // Set initial sidebar state based on screen size
  function setSidebarBasedOnScreenSize() {
    const isSmallScreen = window.innerWidth < 1024;

    if (isSmallScreen) {
      // On small screens, hide sidebar by default
      sidebar.classList.add("hidden");
      sidebar.classList.remove("flex");

      // Make sure sidebar appears as overlay
      sidebar.classList.add("fixed", "z-20", "h-full");
      sidebar.style.width = "75%"; // 3/4 of screen width

      // Show the "show menu" button only
      if (show_menu && hide_menu) {
        show_menu.classList.remove("hidden", "opacity-0");
        show_menu.classList.add("opacity-100");
        hide_menu.classList.add("hidden");
      }

      // Reset main content margin
      mainContent.classList.remove("lg:ml-[300px]");
    } else {
      // On large screens, show sidebar by default and reset styles
      sidebar.classList.remove("hidden", "fixed", "z-20");
      sidebar.classList.add("flex");
      sidebar.style.width = ""; // Reset to CSS default

      // Reset any fixed positioning from mobile view
      sidebar.style.left = "";
      sidebar.style.top = "";

      // Show the "hide menu" button only on large screens
      if (show_menu && hide_menu) {
        hide_menu.classList.remove("hidden", "opacity-0");
        hide_menu.classList.add("opacity-100");
        show_menu.classList.add("hidden");
      }
    }
  }

  // Run on page load
  setSidebarBasedOnScreenSize();

  // Replace the resize event listener with this improved version
  // Add resize listener
  window.addEventListener("resize", () => {
    const isSmallScreen = window.innerWidth < 1024;
    const wasSmallScreen = sidebar.classList.contains("fixed");

    // If transitioning from small to large screen with sidebar open
    if (
      !isSmallScreen &&
      wasSmallScreen &&
      !sidebar.classList.contains("hidden")
    ) {
      // Clean up mobile-specific styles
      sidebar.classList.remove("fixed", "z-20");
      sidebar.style.width = "";
      sidebar.style.left = "";
      sidebar.style.top = "";

      // Hide overlay when transitioning to large screen
      overlay.classList.add("hidden");
    }

    setSidebarBasedOnScreenSize();
  });

  // Only set up toggle functionality if the buttons exist
  if (hide_menu && show_menu) {
    // Event handler for hiding the sidebar
    hide_menu.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isSmallScreen = window.innerWidth < 1024;

      // Hide the sidebar
      sidebar.classList.add("hidden");
      sidebar.classList.remove("flex");

      if (isSmallScreen) {
        // Hide overlay on small screens
        overlay.classList.add("hidden");
      }

      // Start fade out animation for the hide button
      hide_menu.classList.add("opacity-0");

      // Wait for animations to complete before swapping buttons
      setTimeout(() => {
        // Hide the "hide" button completely
        hide_menu.classList.add("hidden");
        hide_menu.classList.remove("opacity-0");

        // Prepare the "show" button to fade in
        show_menu.classList.remove("hidden");
        show_menu.classList.add("opacity-0");

        // Force a reflow to ensure the opacity transition works
        void show_menu.offsetWidth;

        // Start fade in animation for the show button
        show_menu.classList.remove("opacity-0");
        show_menu.classList.add("opacity-100");
      }, 200);
    });

    // Event handler for showing the sidebar
    show_menu.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isSmallScreen = window.innerWidth < 1024;

      if (isSmallScreen) {
        // On small screens, show sidebar as overlay
        sidebar.classList.add("fixed", "z-20");
        sidebar.style.width = "75%";

        // Show overlay
        overlay.classList.remove("hidden");
      } else {
        // Ensure sidebar is properly positioned for desktop view
        sidebar.classList.remove("fixed", "z-20");
        sidebar.style.width = "";
      }

      // Show the sidebar
      sidebar.classList.remove("hidden");
      sidebar.classList.add("flex");

      // Start fade out animation for the show button
      show_menu.classList.add("opacity-0");

      // Wait for animations to complete before swapping buttons
      setTimeout(() => {
        // Hide the "show" button completely
        show_menu.classList.add("hidden");
        show_menu.classList.remove("opacity-0");

        // Prepare the "hide" button to fade in
        hide_menu.classList.remove("hidden");
        hide_menu.classList.add("opacity-0");

        // Force a reflow to ensure the opacity transition works
        void hide_menu.offsetWidth;

        // Start fade in animation for the hide button
        hide_menu.classList.remove("opacity-0");
        hide_menu.classList.add("opacity-100");
      }, 200);
    });

    // Close sidebar when clicking overlay
    overlay.addEventListener("click", () => {
      // Trigger the hide menu button click
      hide_menu.click();
    });
  }

  // ======================================================
  // SIDEBAR MENU GROUP FUNCTIONALITY - COMPATIBILITY LAYER
  // ======================================================

  // First check if we're using the old structure with .group-toggle buttons
  const toggleButtons = document.querySelectorAll(".group-toggle");
  if (toggleButtons.length > 0) {
    /**
     * Closes all submenu elements and resets their arrow rotations
     */
    function closeAllSubmenus() {
      // Hide all submenu containers
      document.querySelectorAll(".submenu").forEach((submenu) => {
        submenu.classList.add("hidden");
      });

      // Reset all toggle button arrow rotations
      document
        .querySelectorAll(".group-toggle svg:last-child")
        .forEach((arrow) => {
          arrow.style.transform = "rotate(0deg)";
        });
    }

    // Add click handlers to all toggle buttons
    toggleButtons.forEach((button) => {
      button.addEventListener("click", function () {
        // Get the submenu and arrow associated with this toggle button
        const submenu = this.nextElementSibling;
        const arrow = this.querySelector("svg:last-child");

        // If the submenu is already open, just close it
        if (!submenu.classList.contains("hidden")) {
          submenu.classList.add("hidden");
          arrow.style.transform = "rotate(0deg)";
          return;
        }

        // Close all other open submenus first
        closeAllSubmenus();

        // Open this submenu
        submenu.classList.remove("hidden");

        // Rotate the arrow to indicate open state
        arrow.style.transform = "rotate(90deg)";
      });
    });
  }

  // ======================================================
  // ACTIVE MENU HIGHLIGHTING FUNCTIONALITY
  // ======================================================

  // Add click handlers to highlight active menu items - works with both structures
  const allNavLinks = document.querySelectorAll("nav a");
  allNavLinks.forEach((link) => {
    link.addEventListener("click", function () {
      // Remove active styling from all nav items and parent items
      clearAllActiveStyles();

      // Add active styling to the clicked item
      this.classList.add("bg-gray-200");
      if (this.classList.contains("border-l-4")) {
        this.classList.add("border-primary");
        this.classList.remove("border-transparent");
      }

      // Highlight parent menu item with a softer style
      highlightParentMenuItem(this);

      // Auto-close sidebar on small screens when a link is clicked
      if (window.innerWidth < 1024 && sidebar && hide_menu) {
        setTimeout(() => {
          hide_menu.click();
        }, 150); // Small delay for better UX
      }
    });
  });

  /**
   * Clears all active styles from menu items
   */
  function clearAllActiveStyles() {
    // Remove active styling from all nav items
    document
      .querySelectorAll("nav a, .group-toggle, summary")
      .forEach((element) => {
        // Remove active stylings - handles both the border and bg approaches
        element.classList.remove(
          "bg-blue-50",
          "border-primary",
          "bg-gray-200",
          "bg-gray-100",
          "parent-active"
        );
        if (element.classList.contains("border-l-4")) {
          element.classList.add("border-transparent");
        }
      });
  }

  /**
   * Highlights the parent menu item with a softer style
   */
  function highlightParentMenuItem(menuItem) {
    // For the old structure
    const parentGroup = menuItem.closest(".menu-group");
    if (parentGroup) {
      const parentToggle = parentGroup.querySelector(".group-toggle");
      if (parentToggle) {
        // Apply a softer highlight style to parent
        parentToggle.classList.add("bg-gray-100", "parent-active");
      }
    }

    // For the new structure with details/summary
    const parentDetails = menuItem.closest("details");
    if (parentDetails) {
      const parentSummary = parentDetails.querySelector("summary");
      if (parentSummary) {
        // Apply a softer highlight style to parent
        parentSummary.classList.add("bg-gray-100", "parent-active");
      }
    }
  }

  // Highlight active menu item based on current URL
  highlightActiveMenuItem();

  /**
   * Highlights the menu item that matches the current URL path
   * and opens its parent menu group if applicable
   */
  function highlightActiveMenuItem() {
    // Get the current URL path
    const currentPath = window.location.pathname;

    // Clear all active styles first
    clearAllActiveStyles();

    // Find and highlight the matching menu item
    allNavLinks.forEach((item) => {
      // Check if this navigation item's href matches the current path
      if (item.getAttribute("href") === currentPath) {
        // Add active styling
        item.classList.add("bg-gray-200");
        if (item.classList.contains("border-l-4")) {
          item.classList.add("border-primary");
          item.classList.remove("border-transparent");
        }

        // For the old structure - open parent menu group if applicable
        const parentGroup = item.closest(".menu-group");
        if (parentGroup) {
          const parentToggle = parentGroup.querySelector(".group-toggle");
          const parentSubmenu = parentGroup.querySelector(".submenu");
          const parentArrow = parentToggle?.querySelector("svg:last-child");

          if (parentToggle) {
            // Apply a softer highlight style to parent
            parentToggle.classList.add("bg-gray-100", "parent-active");
          }

          if (parentSubmenu && parentArrow) {
            // Open the parent submenu
            parentSubmenu.classList.remove("hidden");

            // Rotate the parent's arrow to indicate open state
            parentArrow.style.transform = "rotate(90deg)";
          }
        }

        // For the new structure with details/summary
        const parentDetails = item.closest("details");
        if (parentDetails) {
          // Open the details element
          parentDetails.setAttribute("open", "");

          // Highlight the parent summary
          const parentSummary = parentDetails.querySelector("summary");
          if (parentSummary) {
            parentSummary.classList.add("bg-gray-100", "parent-active");
          }
        }
      }
    });
  }
});
