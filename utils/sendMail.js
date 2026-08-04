import nodemailer from "nodemailer";

export const sendMail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "ravi18homes@gmail.com",
      pass: "hhlgajvfqumgiror",
    },
  });

  await transporter.sendMail({
    from: `"18Homes Support" <${process.env.MAIL_USERNAME}>`,
    to,
    subject,
    html,
  });
};

export const forgotPasswordTemplate = (name, resetUrl) => {
  const userName = name || "there";

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0f766e,#2563eb);padding:28px 24px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:26px;">Reset Your Password</h2>
        <p style="margin:8px 0 0;font-size:15px;opacity:0.95;">Secure your 18Homes account in just one click</p>
      </div>

      <div style="padding:30px 24px;color:#1f2937;line-height:1.7;">
        <p style="margin:0 0 10px;font-size:16px;">Hello <strong>${userName}</strong>,</p>
        <p style="margin:0 0 16px;font-size:15px;">
          We received a request to reset the password for your 18Homes account.
        </p>

        <p style="margin:0 0 20px;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
            Reset Password
          </a>
        </p>

        <p style="margin:0 0 10px;font-size:14px;color:#6b7280;">
          This link is valid for <strong>15 minutes</strong>.
        </p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
          If you didn’t request this password reset, you can safely ignore this email.
        </p>
      </div>

      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
        © ${new Date().getFullYear()} 18Homes. All rights reserved.
      </div>
    </div>
  </body>
</html>
`;
};

export const otpEmailTemplate = (name, otp) => {
  const userName = name || "Valued User";

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email - 18Homes</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#8c4bdc,#c04b7e);padding:28px 24px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:26px;">Verify Your Email Address</h2>
        <p style="margin:8px 0 0;font-size:15px;opacity:0.95;">Welcome to 18Homes!</p>
      </div>

      <div style="padding:30px 24px;color:#1f2937;line-height:1.7;">
        <p style="margin:0 0 10px;font-size:16px;">Hello <strong>${userName}</strong>,</p>
        <p style="margin:0 0 16px;font-size:15px;">
          Thank you for signing up on 18Homes. Please use the following 6-digit One-Time Password (OTP) to verify your account:
        </p>

        <div style="margin:24px 0;text-align:center;">
          <span style="display:inline-block;padding:14px 32px;background:#f3e8ff;color:#7e22ce;font-size:32px;font-weight:bold;letter-spacing:6px;border-radius:12px;border:1px dashed #a855f7;">
            ${otp}
          </span>
        </div>

        <p style="margin:0 0 10px;font-size:14px;color:#6b7280;text-align:center;">
          This OTP is valid for <strong>10 minutes</strong>.
        </p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;text-align:center;">
          If you did not initiate this request, please ignore this email.
        </p>
      </div>

      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
        © ${new Date().getFullYear()} 18Homes. All rights reserved.
      </div>
    </div>
  </body>
</html>
`;
};

