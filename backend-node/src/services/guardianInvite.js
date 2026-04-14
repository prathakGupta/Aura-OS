import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export const generateInviteToken = (guardianId) => {
  return jwt.sign(
    { guardianId },
    process.env.JWT_SECRET,
    { expiresIn: "48h" }
  );
};

export const sendGuardianInviteEmail = async ({
  guardianEmail,
  guardianName,
  userName,
  inviteToken,
}) => {
  const inviteUrl = `${process.env.CLIENT_URL}/auth/invite/${inviteToken}`;

  const mailOptions = {
    from: process.env.MAIL_FROM,
    to: guardianEmail,
    subject: "You've been added as a guardian on AuraOS",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0D0B14; color: #F0ECFF; border-radius: 16px;">
        <h2 style="color: #00C9FF; margin-bottom: 8px;">AuraOS</h2>
        <p style="color: #8B82A7; margin-bottom: 24px;">A calmer space when things feel heavy.</p>
        
        <h3 style="margin-bottom: 8px;">Hi ${guardianName},</h3>
        <p style="line-height: 1.6; color: #C4BDD4;">
          ${userName} has added you as their guardian on AuraOS. 
          This means you'll have access to a private portal where you can 
          support them through the app.
        </p>

        <p style="line-height: 1.6; color: #C4BDD4;">
          To set up your guardian account, click the button below. 
          This link expires in 48 hours.
        </p>

        <a href="${inviteUrl}" 
           style="display: inline-block; margin-top: 24px; padding: 14px 28px; 
                  background: #00C9FF; color: #0D0B14; border-radius: 12px; 
                  text-decoration: none; font-weight: 600;">
          Set up my guardian account
        </a>

        <p style="margin-top: 32px; font-size: 13px; color: #8B82A7;">
          If you weren't expecting this, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};