document.addEventListener("DOMContentLoaded", function () {
  // Logout modal functionality
  const logoutBtn = document.getElementById("logout-btn");
  const profileLogoutBtn = document.getElementById("profile-logout-btn");
  const logoutDialog = document.getElementById("logout-dialog");

  if (logoutBtn && logoutDialog) {
    const closeDialog = document.getElementById("close-dialog");
    const cancelLogout = document.getElementById("cancel-logout");

    // Show dialog when sidebar logout button is clicked
    logoutBtn.addEventListener("click", function (e) {
      logoutDialog.classList.remove("hidden");
      logoutDialog.classList.add("flex");
      e.preventDefault();
      e.stopPropagation();
    });

    // Show dialog when profile menu logout button is clicked
    if (profileLogoutBtn) {
      profileLogoutBtn.addEventListener("click", function (e) {
        // Close the profile menu first
        const profileMenu = document.getElementById("profile-menu");
        if (profileMenu) {
          profileMenu.classList.add("hidden");
        }
        // Then show the logout dialog
        logoutDialog.classList.remove("hidden");
        logoutDialog.classList.add("flex");
        e.preventDefault();
        e.stopPropagation();
      });
    }

    // Hide dialog when close button is clicked
    if (closeDialog) {
      closeDialog.addEventListener("click", function () {
        logoutDialog.classList.remove("flex");
        logoutDialog.classList.add("hidden");
      });
    }

    // Hide dialog when cancel button is clicked
    if (cancelLogout) {
      cancelLogout.addEventListener("click", function () {
        logoutDialog.classList.remove("flex");
        logoutDialog.classList.add("hidden");
      });
    }

    // Close dialog when clicking outside of it
    logoutDialog.addEventListener("click", function (e) {
      if (e.target === logoutDialog) {
        logoutDialog.classList.remove("flex");
        logoutDialog.classList.add("hidden");
      }
    });
  } else {
    console.warn("Logout elements not found in the DOM");
  }
});
