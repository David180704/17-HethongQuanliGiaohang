import nodemailer from "nodemailer";

// Adapter cho nodemailer. Chua cau hinh SMTP (dev/test) thi khong gui di dau, chi
// ghi log - de chay local/CI khong can SMTP that.
export class MailService {
  constructor(smtp) {
    this.from = smtp.from;
    this.realSmtp = Boolean(smtp.host);
    this.transporter = this.realSmtp
      ? nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  async send({ to, subject, html }) {
    const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
    if (!this.realSmtp) console.log(`[MAIL-DEV] Gui toi ${to} - "${subject}"`);
    return info;
  }
}

// Noi dung do nguoi dung nhap (ho ten, ten shop) chen vao email phai escape:
// neu khong, ai do dang ky bang email cua nan nhan voi ten chua the <a href>
// se gui duoc email "chinh chu EDMS" kem link lua dao.
export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
