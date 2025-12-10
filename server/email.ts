import { google } from 'googleapis';
import { getBaseUrl } from '@server/domain.config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';

let connectionSettings: any;
let smtpTransporter: Transporter | null = null;
let resendClient: Resend | null = null;

// Check if Resend is configured (recommended for production)
function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Get or create Resend client
function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('Resend client initialized');
  }
  return resendClient;
}

// Check if Gmail SMTP is configured (standard method)
function isGmailSMTPConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Get or create SMTP transporter
function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    console.log('Gmail SMTP transporter created for:', process.env.GMAIL_USER);
  }
  return smtpTransporter;
}

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Check if the email service is configured properly
 * Returns true if Resend, Gmail SMTP, or Replit connectors are configured
 */
export function isEmailServiceConfigured(): boolean {
  const resendConfigured = isResendConfigured();
  const smtpConfigured = isGmailSMTPConfigured();
  const replitConfigured = !!process.env.REPLIT_CONNECTORS_HOSTNAME;

  if (resendConfigured) {
    console.log('✅ Email service: Resend configured');
  } else if (smtpConfigured) {
    console.log('Email service: Gmail SMTP configured');
  } else if (replitConfigured) {
    console.log('Email service: Replit Gmail connector configured');
  } else {
    console.log('❌ Email service: NOT configured');
  }

  return resendConfigured || smtpConfigured || replitConfigured;
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string;
  attachments?: any;
}

const DEFAULT_FROM_EMAIL = 'projects@kolmo.io';
const DEFAULT_FROM_NAME = "Kolmo Construction";

/**
 * Send an email using Gmail SMTP or Gmail API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const isDev = process.env.NODE_ENV === 'development';
  const fromEmail = options.from || DEFAULT_FROM_EMAIL;
  const fromName = options.fromName || DEFAULT_FROM_NAME;

  // Always print email content in development mode for easier debugging
  if (isDev) {
    console.log('\n==== DEVELOPMENT EMAIL ====');
    console.log(`TO: ${options.to}`);
    console.log(`FROM: ${fromName} <${fromEmail}>`);
    console.log(`SUBJECT: ${options.subject}`);
    console.log('\n---- TEXT CONTENT ----');
    console.log(options.text || '(No text content)');

    const linkRegex = /href="([^"]+)"/g;
    const links = [];
    let match;
    const htmlContent = options.html || '';

    while ((match = linkRegex.exec(htmlContent)) !== null) {
      links.push(match[1]);
    }

    if (links.length > 0) {
      console.log('\n---- IMPORTANT LINKS ----');
      links.forEach((link, index) => {
        console.log(`[${index + 1}] ${link}`);
      });
    }

    console.log('\n==== END EMAIL ====\n');
  }

  if (!isEmailServiceConfigured()) {
    console.warn("Gmail not configured - skipping email send");
    return isDev;
  }

  try {
    let textContent = options.text;
    if (!textContent && options.html) {
      textContent = options.html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Try Resend first (best for production, HTTP-based, no SMTP blocking)
    if (isResendConfigured()) {
      console.log(`Sending email to ${options.to} via Resend...`);

      const resend = getResendClient();
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html || textContent,
      });

      if (result.error) {
        throw new Error(`Resend error: ${result.error.message}`);
      }

      console.log(`✅ Email sent successfully via Resend to ${options.to}`);
      console.log('Email ID:', result.data?.id);
      return true;
    }

    // Fall back to Gmail SMTP (may be blocked on cloud platforms)
    if (isGmailSMTPConfigured()) {
      console.log(`Sending email to ${options.to} via Gmail SMTP...`);

      const transporter = getSmtpTransporter();
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: textContent,
        html: options.html,
      });

      console.log(`✅ Email sent successfully via Gmail SMTP to ${options.to}`);
      console.log('Message ID:', info.messageId);
      return true;
    }

    // Final fallback to Gmail API (Replit connector)
    console.log(`Sending email to ${options.to} via Gmail API...`);
    const gmail = await getGmailClient();

    const message = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      options.html || options.text || ''
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`✅ Email sent successfully via Gmail API to ${options.to}`);
    console.log('Gmail response:', result.data);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send email:', error);
    console.error('Error details:', error.message);

    if (isDev) {
      console.log('Development mode: Email delivery failed, but continuing as if successful');
      return true;
    }

    return false;
  }
}

/**
 * Send a magic link invitation email to a user
 */
export async function sendMagicLinkEmail({
  email,
  firstName,
  token,
  resetPassword = false,
  isNewUser = false
}: {
  email: string;
  firstName: string;
  token: string;
  resetPassword?: boolean;
  isNewUser?: boolean;
}): Promise<boolean> {
  const baseUrl = getBaseUrl();

  const path = resetPassword
    ? `/reset-password?token=${token}`
    : `/api/auth/magic-link/${token}`;

  const link = `${baseUrl}${path}`;

  const subject = resetPassword
    ? 'Reset Your Construction Client Portal Password'
    : isNewUser
      ? 'Welcome to Construction Client Portal - Activate Your Account'
      : 'Access Your Construction Client Portal Account';

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${subject}</title>
</head>
<body style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #3d4552;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 20px 0;">
                <table width="680" cellpadding="0" cellspacing="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 32px rgba(61, 69, 82, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%); color: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 4px solid #db973c;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Kolmo Construction</h1>
                            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 300;">Access Your Account</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 45px 35px;">
                            <h2 style="color: #1a1a1a; margin-top: 0;">Hello ${firstName},</h2>
                            
                            <p>Click the button below to access your account:</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${link}" style="background-color: #db973c; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                                    Access Your Account
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 30px;">Or copy this link:<br/><a href="${link}" style="color: #db973c; word-break: break-all;">${link}</a></p>
                            
                            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject: subject,
    html: emailHtml,
    from: DEFAULT_FROM_EMAIL,
    fromName: DEFAULT_FROM_NAME
  });
}

/**
 * Send account confirmation email
 */
export async function sendAccountConfirmationEmail(email: string, firstName: string): Promise<boolean> {
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Account Confirmed</title>
</head>
<body style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #3d4552;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 20px 0;">
                <table width="680" cellpadding="0" cellspacing="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 32px rgba(61, 69, 82, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%); color: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 4px solid #db973c;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Kolmo Construction</h1>
                            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Welcome to Your Portal</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 45px 35px;">
                            <h2 style="color: #1a1a1a; margin-top: 0;">Welcome, ${firstName}!</h2>
                            <p>Your account has been successfully created. You can now access the portal to view your projects and quotes.</p>
                            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject: 'Account Confirmed - Welcome to Kolmo Construction Portal',
    html: emailHtml,
    from: DEFAULT_FROM_EMAIL,
    fromName: DEFAULT_FROM_NAME
  });
}

/**
 * Send quote acceptance email
 */
export async function sendQuoteAcceptanceEmail(email: string, customerName: string, quoteNumber: string): Promise<boolean> {
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Quote Accepted</title>
</head>
<body style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #3d4f52; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 20px 0;">
                <table width="680" cellpadding="0" cellspacing="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 32px rgba(61, 69, 82, 0.1);">
                    <!-- Gold Top Border -->
                    <tr>
                        <td style="height: 4px; background-color: #d8973c; border-radius: 12px 12px 0 0;"></td>
                    </tr>
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #3d4f52 0%, #4a6670 100%); color: #ffffff; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1.5px;">KOLMO</h1>
                            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Construction Excellence</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 35px;">
                            <h2 style="color: #3d4f52; margin: 0 0 20px 0; font-size: 24px;">Quote Accepted</h2>

                            <p style="margin: 0 0 20px 0; color: #4a6670;">Dear ${customerName},</p>

                            <p style="margin: 0 0 25px 0; color: #4a6670;">Your quote has been accepted. We're excited to begin work on your project.</p>

                            <!-- Quote Info Box -->
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #d8973c;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #4a6670; font-size: 14px;">Quote Number</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #3d4f52; font-family: monospace;">${quoteNumber}</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- Next Steps -->
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0;">
                                <h3 style="margin: 0 0 15px 0; color: #3d4f52; font-size: 16px;">Next Steps</h3>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 6px 0; color: #4a6670; font-size: 14px;">
                                            <span style="color: #d8973c; font-weight: bold;">•</span> Project manager will contact you within 2 business days
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #4a6670; font-size: 14px;">
                                            <span style="color: #d8973c; font-weight: bold;">•</span> Scheduling and planning phase begins
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #4a6670; font-size: 14px;">
                                            <span style="color: #d8973c; font-weight: bold;">•</span> You'll receive regular project updates
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <p style="margin: 25px 0 0 0; color: #4a6670; font-size: 14px;">Questions? Contact us at <a href="mailto:projects@kolmo.io" style="color: #d8973c; text-decoration: none; font-weight: 600;">projects@kolmo.io</a></p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 35px; border-top: 1px solid #f5f5f5; text-align: center;">
                            <p style="margin: 0; color: #4a6670; font-size: 12px;">
                                Automated confirmation • We look forward to working with you
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject: `Quote Accepted - ${quoteNumber}`,
    html: emailHtml,
    from: DEFAULT_FROM_EMAIL,
    fromName: DEFAULT_FROM_NAME
  });
}

/**
 * Send new message notification email
 */
export async function sendNewMessageNotificationEmail({
  recipientEmail,
  recipientFirstName,
  senderName,
  projectName,
  messagePreview
}: {
  recipientEmail: string;
  recipientFirstName: string;
  senderName: string;
  projectName: string;
  messagePreview: string;
}): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const projectUrl = `${baseUrl}/projects`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>New Message Notification</title>
</head>
<body style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #3d4552;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 20px 0;">
                <table width="680" cellpadding="0" cellspacing="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 32px rgba(61, 69, 82, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%); color: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 4px solid #db973c;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Kolmo Construction</h1>
                            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">New Message</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 45px 35px;">
                            <h2 style="color: #1a1a1a; margin-top: 0;">Hello ${recipientFirstName},</h2>
                            <p><strong>${senderName}</strong> sent you a message on project <strong>${projectName}</strong>:</p>
                            <p style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #db973c; border-radius: 4px; color: #666;">
                              "${messagePreview}"
                            </p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${projectUrl}" style="background-color: #db973c; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                                    View Messages
                                </a>
                            </div>
                            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  return sendEmail({
    to: recipientEmail,
    subject: `New message from ${senderName} on ${projectName}`,
    html: emailHtml,
    from: DEFAULT_FROM_EMAIL,
    fromName: DEFAULT_FROM_NAME
  });
}
