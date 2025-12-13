
// src/services/notify.js
import nodemailer from "nodemailer";

function bool(v) {
  return String(v || "").toLowerCase() === "true";
}

const EMAIL_ENABLED = bool(process.env.EMAIL_ENABLED);

export async function sendPriceIncreaseAlert({ asin, oldPrice, newPrice, ratio }) {
  // Never crash your worker if email isn't set up
  if (!EMAIL_ENABLED) {
    console.log(
      `📧 (email disabled) Price increase alert: ${asin} ${oldPrice} -> ${newPrice} (+${(ratio * 100).toFixed(1)}%)`
    );
    return;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const from = process.env.ALERT_FROM || user;
  const to = process.env.ALERT_TO;

  if (!host || !user || !pass || !to) {
    console.log("📧 Email enabled but SMTP env vars missing; skipping alert.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = `Price increased: ${asin} (+${(ratio * 100).toFixed(1)}%)`;
  const text =
    `Product: ${asin}\n` +
    `Old Price: ${oldPrice}\n` +
    `New Price: ${newPrice}\n` +
    `Change: ${(ratio * 100).toFixed(1)}%\n`;

  await transporter.sendMail({ from, to, subject, text });
  console.log("📧 Price increase alert sent:", asin);
}

