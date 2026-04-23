import { config } from '../config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer');

type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporterPromise: Promise<any> | null = null;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const createTransporter = async () => {
  const hasSmtpCredentials = Boolean(config.email.host && config.email.user);

  if (hasSmtpCredentials) {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    });
  }

  let testAccount: any = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      testAccount = await nodemailer.createTestAccount();
      break;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      console.log(`Retrying Ethereal account creation (${attempt}/3)...`);
      await sleep(2000);
    }
  }

  console.log('\n--- [EMAIL SERVICE: ETHEREAL TEST ACCOUNT] ---');
  console.log(`User: ${testAccount.user}`);
  console.log(`Pass: ${testAccount.pass}`);
  console.log('-----------------------------------------------\n');

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
};

const getTransporter = async () => {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((error) => {
      transporterPromise = null;
      throw error;
    });
  }

  return transporterPromise;
};

export const sendEmail = async (options: MailOptions) => {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: config.email.from || 'AI Marketing Tool <noreply@ai-marketing.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  });

  if (info.messageId && !config.email.host) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('\n--- [EMAIL SENT (ETHEREAL PREVIEW)] ---');
    console.log(`Preview URL: ${previewUrl}`);
    console.log('----------------------------------------\n');
    return { ...info, previewUrl };
  }

  return info;
};

export const sendResetEmail = async (toEmail: string, resetUrl: string) => {
  const subject = 'Reset Your Password';
  const text = `You requested a password reset. Use this link to reset your password: ${resetUrl}`;
  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password. This link is valid for 1 hour.</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, text, html });
};

export const sendWelcomeEmail = async (toEmail: string) => {
  const subject = 'Welcome to AI Marketing Tool';
  const text = 'Welcome! Your account has been successfully created.';
  const html = '<h1>Welcome!</h1><p>Your account is ready.</p>';

  return sendEmail({ to: toEmail, subject, text, html });
};
