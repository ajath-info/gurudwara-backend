// public/js/toast.js

let toastTimer = null;
let progressTimer = null;
let startTime = null;
let duration = 5000; // 5 seconds
let isPaused = false;

// Function to close the toast
function closeToast() {
  const toast = document.getElementById("toast-notification");
  if (toast) {
    // Clear any existing timers
    if (toastTimer) clearTimeout(toastTimer);
    if (progressTimer) clearInterval(progressTimer);

    toast.classList.replace("opacity-100", "opacity-0");
    setTimeout(() => {
      toast.style.display = "none";
    }, 500);
  }
}

// Function to update progress bar
function updateProgressBar() {
  const progressBar = document.getElementById("toast-progress");
  if (!progressBar || !startTime) return;

  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, duration - elapsed);
  const percentage = (remaining / duration) * 100;

  progressBar.style.width = percentage + "%";

  if (remaining <= 0) {
    clearInterval(progressTimer);
    closeToast();
  }
}

// Function to start progress bar animation
function startProgressBar() {
  const progressBar = document.getElementById("toast-progress");
  if (!progressBar) {
    console.error("Progress bar element not found");
    return;
  }

  // Reset progress bar to full width
  progressBar.style.width = "100%";

  // Set start time
  startTime = Date.now();
  isPaused = false;

  // Update progress every 50ms
  progressTimer = setInterval(updateProgressBar, 50);

  // Set timer to auto-close
  toastTimer = setTimeout(closeToast, duration);
}

// Function to pause progress bar
function pauseProgressBar() {
  if (progressTimer) {
    clearInterval(progressTimer);
  }
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  isPaused = true;
}

// Function to resume progress bar
function resumeProgressBar() {
  if (!isPaused) return;

  const progressBar = document.getElementById("toast-progress");
  if (!progressBar) return;

  // Calculate remaining time based on current progress
  const currentWidth = parseFloat(progressBar.style.width) || 0;
  const remainingTime = (currentWidth / 100) * duration;

  if (remainingTime > 0) {
    // Reset start time for remaining duration
    startTime = Date.now();
    duration = remainingTime;

    // Restart timers
    progressTimer = setInterval(updateProgressBar, 50);
    toastTimer = setTimeout(closeToast, remainingTime);

    isPaused = false;
  }
}

// Initialize toast functionality when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, looking for toast...");

  const toast = document.querySelector('[data-toast="true"]');

  if (toast) {
    console.log("Toast found, initializing...");

    // Add click handler to close button
    const closeButton = toast.querySelector(".toast-close-btn");
    if (closeButton) {
      closeButton.addEventListener("click", closeToast);
      console.log("Close button handler added");
    }

    // Check if progress bar exists
    const progressBar = document.getElementById("toast-progress");
    if (progressBar) {
      console.log("Progress bar found, starting animation...");
      startProgressBar();
    } else {
      console.error("Progress bar element not found");
    }

    // Pause progress on hover
    toast.addEventListener("mouseenter", pauseProgressBar);
    toast.addEventListener("mouseleave", resumeProgressBar);

    console.log("Toast initialized successfully");
  } else {
    console.log("No toast found on page");
  }
});
