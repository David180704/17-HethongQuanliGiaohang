import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function buildTransport() {
  if (env.smtp.host) {
    return nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  // Chua cau hinh SMTP (dev/test): khong gui di dau, chi tra ve JSON cua email
  // de log lai, tranh phai co SMTP that moi chay duoc local/CI.
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = buildTransport();

export async function sendMail({ to, subject, html }) {
  const info = await transporter.sendMail({ from: env.smtp.from, to, subject, html });
  if (!env.smtp.host) {
    console.log(`[MAIL-DEV] Gui toi ${to} - "${subject}"`);
  }
  return info;
}
