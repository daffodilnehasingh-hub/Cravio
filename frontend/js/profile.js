const API_BASE_URL = "http://localhost:5000/api/auth";
const token = localStorage.getItem("cravio-token");
const form = document.getElementById("profileForm");
const messageBox = document.getElementById("formMessage");
function showMessage(message, success=false) {
  messageBox.textContent = message;
  messageBox.classList.toggle("success", success);
}
function logout() {
  localStorage.removeItem("cravio-token");
  localStorage.removeItem("cravio-user");
  window.location.replace("login.html");
}
async function loadProfile() {
  if (!token) { window.location.replace("login.html"); return; }
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {headers:{Authorization:`Bearer ${token}`}});
    const data = await response.json();
    if (response.status === 401) { logout(); return; }
    if (!response.ok) throw new Error(data.message || "Could not load profile.");
    const user = data.user;
    document.getElementById("name").value = user.name || "";
    document.getElementById("email").value = user.email || "";
    document.getElementById("phone").value = user.phone || "";
    const role = user.role || "customer";
    document.getElementById("roleValue").textContent = role[0].toUpperCase()+role.slice(1);
    const studentValue = document.getElementById("studentValue");
    studentValue.textContent = user.isStudentVerified ? "Verified" : "Not verified";
    studentValue.className = user.isStudentVerified ? "verified" : "unverified";
    document.getElementById("avatar").textContent = (user.name || "C").trim()[0].toUpperCase();
    localStorage.setItem("cravio-user", JSON.stringify(user));
  } catch(error) { showMessage(error.message || "Unable to load your profile."); }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.getElementById("saveButton");
  button.disabled = true; button.textContent = "Saving..."; showMessage("");
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({name:document.getElementById("name").value,phone:document.getElementById("phone").value})
    });
    const data = await response.json();
    if (response.status === 401) { logout(); return; }
    if (!response.ok) throw new Error(data.message || "Could not update profile.");
    localStorage.setItem("cravio-user",JSON.stringify(data.user));
    document.getElementById("avatar").textContent=data.user.name.trim()[0].toUpperCase();
    showMessage(data.message || "Profile updated.",true);
  } catch(error) { showMessage(error.message || "Unable to save changes."); }
  finally { button.disabled=false; button.innerHTML=`${icon("check",14)} Save changes`; }
});
document.getElementById("logoutButton").addEventListener("click",logout);
loadProfile();
