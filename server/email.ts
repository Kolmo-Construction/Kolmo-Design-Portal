import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable is not set. Email functionality will not work.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Check if the email service is configured properly
 */
export function isEmailServiceConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string; // Added fromName
}

// Default sender email - should be a verified domain in SendGrid account
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@kolmo.design';
const DEFAULT_FROM_NAME = "Kolmo Construction";

/**
 * Send an email using SendGrid
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

    // Extract links from HTML content for easy testing
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
    console.warn("SendGrid API key not configured - skipping email send");
    return isDev; // Return true in dev mode so app doesn't break, false in production
  }

  try {
    // Generate plain text from HTML if no text provided
    let textContent = options.text;
    if (!textContent && options.html) {
      // Simple HTML to text conversion - strip HTML tags and decode entities
      textContent = options.html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&amp;/g, '&')  // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')    // Replace multiple whitespace with single space
        .trim();
    }

    const msg = {
      to: options.to,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: options.subject,
      text: textContent || 'Please view this email in HTML format.',
      html: options.html || options.text || ''
    };

    await sgMail.send(msg);
    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send email via SendGrid:', error);
    if (error?.response) {
      console.error('SendGrid error response:', error.response.body);
    }
    
    // In development, consider it a success to avoid breaking the flow
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
  // In Replit environment, use the public URL; otherwise fallback to localhost
  let baseUrl = process.env.BASE_URL;

  if (!baseUrl) {
    if (process.env.REPLIT_SLUG) {
      baseUrl = `https://${process.env.REPLIT_SLUG}.replit.app`;
    } else {
      baseUrl = 'http://localhost:5000'; // Adjust if your local dev port is different
    }
  }

  // Determine the correct path based on the purpose
  // *** FIX: Corrected magic link path to match auth controller ***
  const path = resetPassword
    ? `/reset-password?token=${token}` // Assuming a route like this
    : `/auth/magic-link/${token}`; // Matches auth.ts route

  const link = `${baseUrl}${path}`;

  const subject = resetPassword
    ? 'Reset Your Construction Client Portal Password'
    : isNewUser
      ? 'Welcome to Construction Client Portal - Activate Your Account'
      : 'Access Your Construction Client Portal Account';

  // Determine the message content based on the purpose
  let contentHtml, contentText, buttonText;

  if (resetPassword) {
    contentHtml = `<p>We received a request to reset your password for the Construction Client Portal.</p>
      <p>If you did not make this request, you can safely ignore this email.</p>
      <p>Please click the button below to reset your password:</p>`;
    contentText = 'We received a request to reset your password for the Construction Client Portal. If you did not make this request, you can safely ignore this email.';
    buttonText = 'Reset Password';
  } else if (isNewUser) {
    contentHtml = `<p>Welcome to the Construction Client Portal! We've created an account for you to access your project information.</p>
      <p>Please click the button below to set up your account:</p>`;
    contentText = 'Welcome to the Construction Client Portal! We\'ve created an account for you to access your project information.';
    buttonText = 'Activate My Account';
  } else {
    contentHtml = `<p>You've requested access to your Construction Client Portal account.</p>
      <p>Please click the button below to sign in:</p>`;
    contentText = 'You\'ve requested access to your Construction Client Portal account.';
    buttonText = 'Sign In';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
      <div style="background-color: #3d4f52; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Construction Client Portal</h1>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Hello ${firstName},</p>
        <div style="font-size: 14px; color: #555; line-height: 1.6;">
          ${contentHtml}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}"
             style="background-color: #d8973c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            ${buttonText}
          </a>
        </div>
        <p style="font-size: 14px; color: #555; line-height: 1.6;">This link will expire in 24 hours for security reasons.</p>
        <p style="font-size: 14px; color: #555; line-height: 1.6;">If you're having trouble with the button above, copy and paste the URL below into your web browser:</p>
        <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; color: #333;">${link}</p>
        <p style="font-size: 14px; color: #555; line-height: 1.6;">If you didn't request this email, please ignore it.</p>
        <p style="font-size: 14px; color: #555; line-height: 1.6;">Thank you,<br>The Construction Portal Team</p>
      </div>
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  `;

  const text = `
Hello ${firstName},

${contentText}

Please use the following link to ${resetPassword ? 'reset your password' : (isNewUser ? 'set up your account' : 'sign in')}:
${link}

This link will expire in 24 hours for security reasons.

If you didn't request this email, please ignore it.

Thank you,
The Construction Portal Team

This is an automated message, please do not reply to this email.
`;

  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}


// --- NEW FUNCTION for Message Notifications ---
interface NewMessageEmailOptions {
    recipientEmail: string;
    recipientFirstName: string;
    senderName: string;
    projectName: string;
    messageSubject: string;
    messageLink: string; // Link to the project's message tab
}

export async function sendNewMessageNotificationEmail({
    recipientEmail,
    recipientFirstName,
    senderName,
    projectName,
    messageSubject,
    messageLink
}: NewMessageEmailOptions): Promise<boolean> {

    const subject = `New Message in Project: ${projectName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
        <div style="background-color: #3d4f52; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Construction Client Portal</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Hello ${recipientFirstName},</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            You have received a new message from <strong>${senderName}</strong> regarding the project: <strong>${projectName}</strong>.
          </p>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            <strong>Subject:</strong> ${messageSubject}
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${messageLink}"
               style="background-color: #d8973c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              View Message
            </a>
          </div>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            You can view this message and reply by logging into the client portal.
          </p>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">Thank you,<br>The Construction Portal Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;

    const text = `
Hello ${recipientFirstName},

You have received a new message from ${senderName} regarding the project: ${projectName}.

Subject: ${messageSubject}

You can view this message and reply by logging into the client portal:
${messageLink}

Thank you,
The Construction Portal Team

This is an automated message, please do not reply to this email.
`;

    return sendEmail({
        to: recipientEmail,
        subject,
        html,
        text
    });
}
// --- END NEW FUNCTION ---
