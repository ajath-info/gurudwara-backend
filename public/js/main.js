// Main JavaScript file for admin panel

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  initializeSearch();
  initializeTooltips();
  initializeModals();
  initializeFormValidation();

  // Add active class to current page in sidebar
  const currentPath = window.location.pathname;
  const sidebarLinks = document.querySelectorAll("aside a");
  sidebarLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("sidebar-active");
    }
  });
});

// Search functionality
function initializeSearch() {
  const searchInputs = document.querySelectorAll(
    'input[type="search"], input[name="search"]'
  );
  searchInputs.forEach((input) => {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        this.closest("form").submit();
      }
    });
  });
}

// Tooltip initialization
function initializeTooltips() {
  const tooltipElements = document.querySelectorAll("[title]");
  tooltipElements.forEach((element) => {
    element.addEventListener("mouseenter", function () {
      // Simple tooltip implementation
      const title = this.getAttribute("title");
      if (title) {
        const tooltip = document.createElement("div");
        tooltip.className =
          "absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg";
        tooltip.textContent = title;
        tooltip.style.top = this.offsetTop - 30 + "px";
        tooltip.style.left = this.offsetLeft + "px";
        document.body.appendChild(tooltip);

        this.addEventListener(
          "mouseleave",
          function () {
            document.body.removeChild(tooltip);
          },
          { once: true }
        );
      }
    });
  });
}

// Modal functionality
function initializeModals() {
  // Close modal when clicking outside
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("modal-backdrop")) {
      closeModal();
    }
  });

  // Close modal with escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeModal();
    }
  });
}

// Form validation
function initializeFormValidation() {
  const forms = document.querySelectorAll("form[data-validate]");
  forms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      if (!validateForm(this)) {
        e.preventDefault();
      }
    });
  });
}

// Utility functions
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(modalId = null) {
  if (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
    }
  } else {
    // Close all modals
    const modals = document.querySelectorAll(".modal");
    modals.forEach((modal) => {
      modal.classList.add("hidden");
    });
  }
  document.body.style.overflow = "auto";
}

// Form validation
function validateForm(form) {
  const requiredFields = form.querySelectorAll("[required]");
  let isValid = true;

  requiredFields.forEach((field) => {
    if (!field.value.trim()) {
      field.classList.add("border-red-500");
      isValid = false;

      // Show error message
      let errorMsg = field.parentNode.querySelector(".error-message");
      if (!errorMsg) {
        errorMsg = document.createElement("p");
        errorMsg.className = "error-message text-red-500 text-xs mt-1";
        field.parentNode.appendChild(errorMsg);
      }
      errorMsg.textContent = "This field is required";
    } else {
      field.classList.remove("border-red-500");
      const errorMsg = field.parentNode.querySelector(".error-message");
      if (errorMsg) {
        errorMsg.remove();
      }
    }
  });

  return isValid;
}

// Confirm delete actions
function confirmDelete(message = "Are you sure you want to delete this item?") {
  return confirm(message);
}

// Toggle sidebar on mobile
function toggleSidebar() {
  const sidebar = document.querySelector("aside");
  if (sidebar) {
    sidebar.classList.toggle("sidebar-mobile");
    sidebar.classList.toggle("open");
  }
}

// Loading state management
function showLoading(element) {
  if (element) {
    element.disabled = true;
    element.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
  }
}

function hideLoading(element, originalText) {
  if (element) {
    element.disabled = false;
    element.innerHTML = originalText;
  }
}

// AJAX helper functions
function makeRequest(url, options = {}) {
  const defaultOptions = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  return fetch(url, { ...defaultOptions, ...options })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      console.error("Request failed:", error);
      toastr.error("Request failed. Please try again.");
      throw error;
    });
}

// Status toggle functionality
function toggleStatus(url, currentStatus, confirmMessage) {
  if (confirm(confirmMessage)) {
    const newStatus = currentStatus === "1" ? "2" : "1";

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `status=${newStatus}`,
    })
      .then((response) => {
        if (response.ok) {
          location.reload();
        } else {
          toastr.error("Failed to update status");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        toastr.error("Error updating status");
      });
  }
}

// Date formatting utilities
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Number formatting utilities
function formatNumber(number) {
  return new Intl.NumberFormat().format(number);
}

function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

// Local storage utilities
function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

function getFromLocalStorage(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to get from localStorage:", error);
    return null;
  }
}

// Export functions for global use
window.showModal = showModal;
window.closeModal = closeModal;
window.confirmDelete = confirmDelete;
window.toggleSidebar = toggleSidebar;
window.validateForm = validateForm;
window.toggleStatus = toggleStatus;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatNumber = formatNumber;
window.makeRequest = makeRequest;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// Initialize charts (placeholder for future chart implementation)
function initializeCharts() {
  // This would integrate with Chart.js or similar library
  console.log("Charts initialized");
}

window.initializeCharts = initializeCharts;

// Auto-refresh functionality for real-time data
function startAutoRefresh(interval = 30000) {
  setInterval(() => {
    // Refresh specific data without full page reload
    refreshDashboardStats();
  }, interval);
}

function refreshDashboardStats() {
  // Implementation for refreshing dashboard statistics
  console.log("Refreshing dashboard stats...");
}

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  // Ctrl/Cmd + K for search
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput) {
      searchInput.focus();
    }
  }

  // Escape to close modals
  if (e.key === "Escape") {
    closeModal();
  }
});

// Print functionality
function printPage() {
  window.print();
}

window.printPage = printPage;

// Theme management (for future dark mode implementation)
function toggleTheme() {
  const body = document.body;
  body.classList.toggle("dark-theme");

  const isDark = body.classList.contains("dark-theme");
  saveToLocalStorage("theme", isDark ? "dark" : "light");
}

function initializeTheme() {
  const savedTheme = getFromLocalStorage("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }
}

window.toggleTheme = toggleTheme;

// Initialize theme on load
initializeTheme();
