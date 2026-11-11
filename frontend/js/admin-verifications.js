const API_BASE_URL = "http://localhost:5000/api/student-verification";
const token = localStorage.getItem("cravio-token");
const queue = document.getElementById("verificationQueue");
const message = document.getElementById("adminMessage");
function escapeHtml(value) {
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function logout() {
  localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");
  window.location.replace("login.html");
}
async function loadQueue() {
  if (!token) { window.location.replace("login.html"); return; }
  queue.textContent="Loading submissions...";
  try {
    const response=await fetch(`${API_BASE_URL}/pending`,{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json();
    if (response.status===401) { logout(); return; }
    if (response.status===403) { queue.textContent="Admin access is required to review student IDs."; return; }
    if (!response.ok) throw new Error(data.message||"Unable to load review queue.");
    const rows=data.verifications||[];
    if (!rows.length) { queue.innerHTML='<div class="queue-empty"><span class="empty-state-icon"><span data-icon="shield-check" data-size="26"></span></span>There are no pending student ID submissions.</div>'; return; }
    queue.innerHTML=rows.map(v=>`<article class="verification-card" data-user-id="${escapeHtml(v.id)}">
      <div class="verification-details"><strong>${escapeHtml(v.name)}</strong>
      <p>Email: ${escapeHtml(v.email)}</p><p>Phone: ${escapeHtml(v.phone||"Not provided")}</p>
      <p>Submitted: ${escapeHtml(new Date(v.submittedAt).toLocaleString("en-IN"))}</p>
      <input class="review-reason" type="text" maxlength="300" placeholder="Reason (required only when rejecting)">
      <div class="review-actions"><button type="button" class="btn btn-sm" data-decision="approved">Approve</button><button type="button" class="reject btn-danger btn-sm" data-decision="rejected">Reject</button></div></div>
      <div><img src="${escapeHtml(v.imageUrl)}" alt="Submitted student ID for ${escapeHtml(v.name)}"></div>
    </article>`).join("");
    queue.querySelectorAll("button[data-decision]").forEach(button=>button.addEventListener("click",review));
  } catch(error) { queue.textContent=error.message||"Unable to load review queue."; }
}
async function review(event) {
  const button=event.currentTarget;
  const card=button.closest(".verification-card");
  const decision=button.dataset.decision;
  const reason=card.querySelector(".review-reason").value.trim();
  if (decision==="rejected" && !reason) { message.textContent="Enter a reason before rejecting this submission."; return; }
  button.disabled=true;
  try {
    const response=await fetch(`${API_BASE_URL}/${card.dataset.userId}/review`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({decision,reason})
    });
    const data=await response.json();
    if (!response.ok) throw new Error(data.message||"Review action failed.");
    message.textContent=data.message;
    await loadQueue();
  } catch(error) { message.textContent=error.message||"Unable to submit review."; button.disabled=false; }
}
loadQueue();
