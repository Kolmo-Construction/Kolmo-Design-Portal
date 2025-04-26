import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

// Initialize MailerSend with API key
let mailerSend: MailerSend | null = null;

if (!process.env.MAILERSEND_API_KEY) {
  console.warn("MAILERSEND_API_KEY environment variable is not set. Email functionality will not work.");
} else {
  mailerSend = new MailerSend({
    apiKey: process.env.MAILERSEND_API_KEY
  });
}

/**
 * Check if the email service is configured properly
 */
export function isEmailServiceConfigured(): boolean {
  return !!process.env.MAILERSEND_API_KEY;
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

// Default sender email - should be a verified domain in MailerSend account
// Can be overridden with environment variable
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@constructionportal.com';

/**
 * Send an email using MailerSend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const isDev = process.env.NODE_ENV === 'development';
  const fromEmail = options.from || DEFAULT_FROM_EMAIL;
  const fromName = "Construction Portal";

  // Always print email content in development mode for easier debugging
  if (isDev) {
    console.log('\n==== DEVELOPMENT EMAIL ====');
    console.log(`TO: ${options.to}`);
    console.log(`FROM: ${fromEmail}`);
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
    
    // In development mode with no API key, just return success without trying to send
    if (!process.env.MAILERSEND_API_KEY) {
      console.log('Development mode: Skipping actual email delivery (no API key)');
      return true;
    }
  }

  // Check for MailerSend API key and client for actual email delivery
  if (!mailerSend || !process.env.MAILERSEND_API_KEY) {
    console.error("Cannot send email: MAILERSEND_API_KEY is not set");
    return false;
  }

  try {
    const emailParams = new EmailParams()
      .setFrom(new Sender(fromEmail, fromName))
      .setTo([new Recipient(options.to)])
      .setSubject(options.subject);
    
    if (options.html) {
      emailParams.setHtml(options.html);
    }
    
    if (options.text) {
      emailParams.setText(options.text);
    }

    await mailerSend.email.send(emailParams);
    console.log(`Email sent to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    
    // In development, consider it a success even if MailerSend fails
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
      baseUrl = 'http://localhost:5000';
    }
  }
  
  // Determine the correct path based on the purpose
  const path = resetPassword 
    ? `/reset-password/${token}` 
    : `/magic-link/${token}`;
  
  const magicLink = `${baseUrl}${path}`;
  // isNewUser should be passed as a parameter from auth.ts, not derived from token
  
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #3d4f52; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Construction Client Portal</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <p>Hello ${firstName},</p>
        
        ${contentHtml}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" 
             style="background-color: #d8973c; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            ${buttonText}
          </a>
        </div>
        
        <p>This link will expire in 24 hours for security reasons.</p>
        
        <p>If you're having trouble with the button above, copy and paste the URL below into your web browser:</p>
        <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; font-size: 12px;">${magicLink}</p>
        
        <p>If you didn't request this email, please ignore it.</p>
        
        <p>Thank you,<br>Construction Client Portal Team</p>
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
${magicLink}

This link will expire in 24 hours for security reasons.

If you didn't request this email, please ignore it.

Thank you,
Construction Client Portal Team
`;

  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}