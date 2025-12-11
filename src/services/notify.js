
// src/services/notify.js
import nodemailer from "nodemailer";

const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendPriceIncreaseAlert({ asin, oldPrice, newPrice, ratio }) {
  if (!transporter || !ALERT_EMAIL_TO) {
    console.log("Email alert skipped (no SMTP or ALERT_EMAIL_TO set)");
    return;
  }

  const subject = `Price increase detected for ${asin || "product"}`;
  const text = `
Price increase detected:

ASIN: ${asin || "N/A"}
Old Price: ${oldPrice}
New Price: ${newPrice}
Change: ${(ratio * 100).toFixed(1)}%

You may want to adjust your Shopify pricing or pause ads.
  `.trim();

  await transporter.sendMail({
    from: ALERT_EMAIL_FROM || SMTP_USER,
    to: ALERT_EMAIL_TO,
    subject,
    text,
  });

  console.log("📧 Sent price increase alert email");
}
