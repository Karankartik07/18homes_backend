import nodemailer from "nodemailer";

export const sendMail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "ravi18homes@gmail.com",
      pass: "mburtrhhhnmjrfsj",
    },
  });

  await transporter.sendMail({
    from: `"18Homes Support" <${process.env.MAIL_USERNAME}>`,
    to,
    subject,
    html,
  });
};


export const forgotPasswordTemplate = (name, resetUrl) => `
<!DOCTYPE html>
<html>
<body>
  <h2>Password Reset Request</h2>

  <p>Hello <b>${name}</b>,</p>

  <p>You requested to reset your password.</p>

  <p>
    <a href="${resetUrl}" 
       style="padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;">
       Reset Password
    </a>
  </p>

  <p>This link is valid for <b>15 minutes</b>.</p>

  <p>If you didn’t request this, ignore this email.</p>

  <hr />
  <p>© ${new Date().getFullYear()} Company</p>
</body>
</html>
`;
