document.addEventListener("DOMContentLoaded", () => {
  // Attach togglePassword to all elements with data-toggle-password attribute
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => togglePassword(button));
  });
});

function togglePassword(button) {
  const inputId = button.getAttribute("data-toggle-password");
  const passwordInput = document.getElementById(inputId);
  const passwordIcon = button.querySelector("i");

  if (passwordInput && passwordIcon) {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      passwordIcon.classList.remove("fa-eye");
      passwordIcon.classList.add("fa-eye-slash");
    } else {
      passwordInput.type = "password";
      passwordIcon.classList.remove("fa-eye-slash");
      passwordIcon.classList.add("fa-eye");
    }
  }
}
