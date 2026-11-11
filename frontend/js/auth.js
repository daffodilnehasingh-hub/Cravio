// Change this URL if your backend runs on a different host or port.
const API_BASE_URL = "http://localhost:5000/api/auth";

// Respect the visitor's saved theme (set by the theme toggle on other pages).
try {
  document.documentElement.dataset.theme = localStorage.getItem("cravio-theme") || "light";
} catch (themeError) {
  /* localStorage unavailable — stay light */
}

function showMessage(message, success = false, elementId = "formMessage") {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = message;
  box.classList.toggle("success", success);
}

function saveSession(data) {
  // For this learning MVP only. Production apps should prefer Secure, HttpOnly, SameSite cookies.
  localStorage.setItem("cravio-token", data.token);
  localStorage.setItem("cravio-user", JSON.stringify(data.user));
  window.location.href = "index.html";
}

async function postAuth(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.data = data;
    throw error;
  }
  return data;
}

async function submitAuthForm(form, endpoint) {
  const button = document.getElementById("submitButton");
  const payload = Object.fromEntries(new FormData(form).entries());
  button.disabled = true;
  button.textContent = endpoint === "login" ? "Logging in..." : "Creating account...";
  showMessage("");

  try {
    const data = await postAuth(endpoint, payload);
    if (endpoint === "register" && data.verificationRequired) {
      const verifyForm = document.getElementById("verifyEmailForm");
      document.getElementById("verifyEmail").value = data.email || payload.email;
      verifyForm.hidden = false;
      form.hidden = true;
      showMessage(data.message, true, "verifyMessage");
      return;
    }
    saveSession(data);
  } catch (error) {
    showMessage(error.message || "Unable to connect. Check that the backend is running.");
    if (endpoint === "login" && error.data && error.data.verificationRequired) {
      const panel = document.getElementById("loginVerification");
      if (panel) {
        panel.hidden = false;
        panel.dataset.email = error.data.email || payload.email;
      }
    }
  } finally {
    button.disabled = false;
    button.textContent = endpoint === "login" ? "Login" : "Create account";
  }
}

const loginForm = document.getElementById("loginForm");
if (loginForm) loginForm.addEventListener("submit", event => {
  event.preventDefault();
  submitAuthForm(loginForm, "login");
});

const registerForm = document.getElementById("registerForm");
if (registerForm) registerForm.addEventListener("submit", event => {
  event.preventDefault();
  submitAuthForm(registerForm, "register");
});

const verifyForm = document.getElementById("verifyEmailForm");
if (verifyForm) {
  verifyForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = document.getElementById("verifyButton");
    const payload = Object.fromEntries(new FormData(verifyForm).entries());
    button.disabled = true;
    try {
      const data = await postAuth("verify-email", payload);
      showMessage(data.message, true, "verifyMessage");
      if (data.token) saveSession(data);
    } catch (error) {
      showMessage(error.message, false, "verifyMessage");
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("resendButton").addEventListener("click", async () => {
    const email = document.getElementById("verifyEmail").value.trim();
    try {
      const data = await postAuth("resend-verification", { email });
      showMessage(data.message, true, "verifyMessage");
    } catch (error) {
      showMessage(error.message, false, "verifyMessage");
    }
  });
}

const loginResend = document.getElementById("loginResendButton");
if (loginResend) loginResend.addEventListener("click", async () => {
  const panel = document.getElementById("loginVerification");
  try {
    const data = await postAuth("resend-verification", { email: panel.dataset.email });
    showMessage(data.message, true);
  } catch (error) {
    showMessage(error.message);
  }
});


// Password recovery flow
const forgotPanel = document.getElementById("forgotPasswordPanel");
const showForgot = document.getElementById("showForgotPassword");
const backToLogin = document.getElementById("backToLogin");
if (showForgot && forgotPanel) {
  showForgot.addEventListener("click", () => {
    document.getElementById("loginForm").hidden = true;
    document.getElementById("loginVerification").hidden = true;
    forgotPanel.hidden = false;
    document.getElementById("resetRequestEmail").value = document.getElementById("email").value;
  });
}
if (backToLogin && forgotPanel) {
  backToLogin.addEventListener("click", () => {
    forgotPanel.hidden = true;
    document.getElementById("loginForm").hidden = false;
  });
}
const requestResetForm = document.getElementById("requestResetForm");
if (requestResetForm) requestResetForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("resetRequestEmail").value.trim();
  const button = document.getElementById("requestResetButton");
  button.disabled = true;
  try {
    const data = await postAuth("request-password-reset", { email });
    document.getElementById("resetEmail").value = email;
    document.getElementById("resetPasswordForm").hidden = false;
    showMessage(data.message, true, "resetRequestMessage");
  } catch (error) {
    showMessage(error.message, false, "resetRequestMessage");
  } finally {
    button.disabled = false;
  }
});
const resetPasswordForm = document.getElementById("resetPasswordForm");
if (resetPasswordForm) resetPasswordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmNewPassword").value;
  if (newPassword !== confirmPassword) {
    showMessage("The passwords do not match.", false, "resetPasswordMessage");
    return;
  }
  const button = document.getElementById("resetPasswordButton");
  button.disabled = true;
  try {
    const data = await postAuth("reset-password", {
      email: document.getElementById("resetEmail").value.trim(),
      otp: document.getElementById("resetOtp").value.trim(),
      newPassword
    });
    showMessage(data.message, true, "resetPasswordMessage");
    const resetEmailValue = document.getElementById("resetEmail").value;
    resetPasswordForm.reset();
    document.getElementById("resetPasswordForm").hidden = true;
    document.getElementById("requestResetForm").hidden = false;
    document.getElementById("loginForm").hidden = false;
    forgotPanel.hidden = true;
    document.getElementById("email").value = resetEmailValue;
    document.getElementById("password").focus();
  } catch (error) {
    showMessage(error.message, false, "resetPasswordMessage");
  } finally {
    button.disabled = false;
  }
});

// Password visibility toggles (UI only — values and validation untouched).
function bindPasswordToggle(buttonId, inputId) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  if (!button || !input) return;
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.classList.toggle("is-on", show);
    button.setAttribute("aria-pressed", show ? "true" : "false");
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
}
bindPasswordToggle("toggleLoginPassword", "password");
bindPasswordToggle("toggleRegisterPassword", "password");
bindPasswordToggle("toggleNewPassword", "newPassword");
bindPasswordToggle("toggleConfirmNewPassword", "confirmNewPassword");
