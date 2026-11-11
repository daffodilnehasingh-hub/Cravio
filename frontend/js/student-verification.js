const API_BASE_URL = "http://localhost:5000/api/student-verification";
const token = localStorage.getItem("cravio-token");
const form = document.getElementById("verificationForm");
const statusPanel = document.getElementById("verificationStatus");
const messageBox = document.getElementById("formMessage");
const fileInput = document.getElementById("studentId");
function logoutToLogin() { window.location.replace("login.html"); }
function showMessage(message, success=false) {
  messageBox.textContent = message;
  messageBox.classList.toggle("success", success);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
async function loadStatus() {
  if (!token) { logoutToLogin(); return; }
  try {
    const response = await fetch(`${API_BASE_URL}/me`, { headers:{Authorization:`Bearer ${token}`} });
    const data = await response.json();
    if (response.status === 401) { logoutToLogin(); return; }
    if (!response.ok) throw new Error(data.message || "Could not load verification status.");
    const v = data.verification;
    statusPanel.className = `status-panel ${v.studentVerificationStatus}`;
    if (v.isStudentVerified) {
      statusPanel.innerHTML = `${icon("check-circle",16)} <span>Your student status is verified. Eligible student discounts can now be applied at checkout.</span>`;
      form.hidden = true;
    } else if (v.studentVerificationStatus === "pending") {
      statusPanel.innerHTML = `${icon("clock",16)} <span>Your student ID is waiting for admin review. You will see the result here.</span>`;
      form.hidden = true;
    } else if (v.studentVerificationStatus === "rejected") {
      statusPanel.innerHTML = `${icon("alert",16)} <span>Your previous submission was rejected. Reason: ${escapeHtml(v.studentVerificationRejectionReason || "Please submit a clearer valid ID.")} You can upload again below.</span>`;
      form.hidden = false;
    } else {
      statusPanel.innerHTML = `${icon("info",16)} <span>You have not submitted your student ID yet.</span>`;
      form.hidden = false;
    }
  } catch (error) {
    statusPanel.textContent = error.message || "Unable to check verification status.";
  }
}
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  const wrap = document.getElementById("previewWrap");
  if (!file) { wrap.hidden = true; return; }
  if (file.size > 5*1024*1024) {
    showMessage("The selected image is larger than 5 MB.");
    fileInput.value = ""; wrap.hidden = true; return;
  }
  const url = URL.createObjectURL(file);
  document.getElementById("previewImage").src = url;
  wrap.hidden = false;
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) { showMessage("Choose your student ID image first."); return; }
  const allowed = ["image/jpeg","image/png","image/webp"];
  if (!allowed.includes(file.type) || file.size > 5*1024*1024) {
    showMessage("Upload a JPG, PNG or WEBP image smaller than 5 MB."); return;
  }
  const button = document.getElementById("submitButton");
  button.disabled = true; button.textContent = "Uploading securely...";
  showMessage("");
  try {
    const body = new FormData();
    body.append("studentId", file);
    const response = await fetch(`${API_BASE_URL}/submit`, {
      method:"POST", headers:{Authorization:`Bearer ${token}`}, body
    });
    const data = await response.json();
    if (response.status === 401) { logoutToLogin(); return; }
    if (!response.ok) throw new Error(data.message || "Upload failed.");
    showMessage(data.message, true);
    form.reset();
    document.getElementById("previewWrap").hidden = true;
    await loadStatus();
  } catch (error) { showMessage(error.message || "Unable to submit your student ID."); }
  finally { button.disabled = false; button.textContent = "Submit for verification"; }
});
loadStatus();
