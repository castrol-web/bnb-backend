import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

//credentials 
const port = Number(process.env.EMAIL_PORT);
const host = process.env.HOST;
const user = process.env.USER;
const pass = process.env.PASS;
const secure = Boolean(process.env.SECURE);


export const transport = nodemailer.createTransport({
  host,
  service: "gmail",
  secure,
  port,
  auth: {
    user,
    pass
  }
});

export const getMailOptions = (userEmail: string, userName: string, token: string) => {
  const confirmationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  return {
    from: `"Helenus Agency" <${user}>`,
    to: userEmail,
    subject: "Confirm Your Email Address",
    html: `
   <div style="font-family:sans-serif; padding:20px;">
    <h2>Hello ${userName}, welcome to Helenus Agency!</h2>
    <p>Click below to verify your email address:</p>
    <a href="${confirmationUrl}" style="padding:10px 15px; background:#1D4ED8; color:white; text-decoration:none; border-radius:5px;">Verify Email</a>
    <p>This link will expire in 24 hours. If you didn't register, you can ignore this message.</p>

    <hr />
    <p>Need help? <a href="mailto:support@helenusagency.com" style="color:#1D4ED8;">Email us</a> or <a href="https://wa.me/255712345678" style="color:#1D4ED8;">WhatsApp us</a>.</p>
  </div>
    `,
  };
};
