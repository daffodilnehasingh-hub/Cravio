const nodemailer = require("nodemailer");

let transporter;
let demoMode = !process.env.SMTP_HOST;

function getTransporter() {
  if (demoMode) return null;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Email is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS to backend/.env.");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

exports.sendVerificationEmail = async (email, name, otp) => {
  if (demoMode) {
    // In demo mode, just log the OTP and return success
    console.log(`[DEMO] OTP for ${email}: ${otp}`);
    return true;
  }
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to: email,
    subject: "Verify your Cravio email",
    text: `Hi ${name}, your Cravio verification code is ${otp}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#202020"><h2>Welcome to Cravio!</h2><p>Hi ${escapeHtml(name)},</p><p>Use this one-time code to verify your email address:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#f4f4f4;text-align:center;border-radius:12px">${otp}</div><p>This code expires in <b>10 minutes</b>. Do not share it with anyone.</p><p>Cravio · Good food, good mood.</p></div>`
  });
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&", "<": "<", ">": ">", '"': """, "'": "'"
  }[char]));
}

exports.sendPasswordResetEmail = async (email, name, otp) => {
  if (demoMode) {
    console.log(`[DEMO] Password reset OTP for ${email}: ${otp}`);
    return true;
  }
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to: email,
    subject: "Reset your Cravio password",
    text: `Hi ${name}, your Cravio password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#202020"><h2>Reset your Cravio password</h2><p>Hi ${escapeHtml(name)},</p><p>Use this one-time code to reset your password:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#f4f4f4;text-align:center;border-radius:12px">${otp}</div><p>This code expires in <b>10 minutes</b>. If you did not request a password reset, you can safely ignore this email.</p><p>Do not share this code with anyone.</p></div>`
  });
};