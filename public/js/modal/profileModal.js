document.addEventListener("DOMContentLoaded", function () {
  // Profile menu dropdown functionality
  const profileIcon = document.getElementById("profile-icon");
  const profileMenu = document.getElementById("profile-menu");

  if (!profileIcon || !profileMenu) {
    console.warn("Profile elements not found in the DOM");
    return;
  }

  // Toggle profile menu on click
  profileIcon.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("clicked");

    // Add a simple toggle with animation classes
    if (profileMenu.classList.contains("hidden")) {
      console.log("Hey");
      // Show menu with fade-in effect
      profileMenu.classList.remove("hidden");
      profileMenu.classList.add("opacity-0");

      // Force reflow
      void profileMenu.offsetWidth;

      profileMenu.classList.add("opacity-100");
      profileMenu.classList.add("translate-y-0");
      profileMenu.classList.remove("opacity-0");
      profileMenu.classList.remove("-translate-y-1");
    } else {
      // Hide menu with fade-out effect
      profileMenu.classList.add("opacity-0");
      profileMenu.classList.add("-translate-y-1");
      profileMenu.classList.remove("opacity-100");
      profileMenu.classList.remove("translate-y-0");

      // Hide after animation completes
      setTimeout(() => {
        profileMenu.classList.add("hidden");
      }, 200);
    }
  });

  // Close profile menu when clicking outside
  document.addEventListener("click", function (e) {
    if (
      profileMenu &&
      !profileIcon.contains(e.target) &&
      !profileMenu.contains(e.target)
    ) {
      profileMenu.classList.add("opacity-0");
      profileMenu.classList.add("-translate-y-1");
      profileMenu.classList.remove("opacity-100");
      profileMenu.classList.remove("translate-y-0");

      setTimeout(() => {
        profileMenu.classList.add("hidden");
      }, 200);
    }
  });
});
