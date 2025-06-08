import { QuoteRepository } from "./server/storage/repositories/quote.repository";
import { sendEmail } from "./server/email";

async function debugQuoteEmail() {
  console.log('=== Debug Quote Email Functionality ===');
  
  try {
    // Initialize quote repository
    const quoteRepository = new QuoteRepository();
    
    // Get quote #4 details
    console.log('Fetching quote #4 details...');
    const quote = await quoteRepository.getQuoteById(4);
    
    if (!quote) {
      console.error('Quote #4 not found');
      return false;
    }
    
    console.log('Quote details:', {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      total: quote.total,
      status: quote.status
    });
    
    // Check if customer info is present
    if (!quote.customerEmail || !quote.customerName) {
      console.error('Missing customer information:', {
        hasEmail: !!quote.customerEmail,
        hasName: !!quote.customerName
      });
      return false;
    }
    
    // Try to send a test email using the same data structure
    console.log('Attempting to send test quote email...');
    
    const formatCurrency = (amount: string) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(parseFloat(amount));
    };

    const formatDate = (date: Date | string) => {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    
    const quoteLink = `https://example.com/quote/${quote.accessToken}`;
    
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3d4552;">Your Quote from Kolmo Construction</h2>
      <p>Hello ${quote.customerName},</p>
      <p>Your quote #${quote.quoteNumber} for "${quote.title}" is ready.</p>
      <p><strong>Total: ${formatCurrency(quote.total)}</strong></p>
      <p><a href="${quoteLink}" style="background: #db973c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Quote</a></p>
      <p>Best regards,<br>Kolmo Construction Team</p>
    </div>`;

    const emailText = `
    Hello ${quote.customerName},
    
    Your quote #${quote.quoteNumber} for "${quote.title}" is ready.
    Total: ${formatCurrency(quote.total)}
    
    View your quote: ${quoteLink}
    
    Best regards,
    Kolmo Construction Team`;

    const emailSent = await sendEmail({
      to: quote.customerEmail,
      subject: `Test Quote #${quote.quoteNumber} from Kolmo Construction`,
      text: emailText,
      html: emailHtml,
      from: 'projects@kolmo.io',
      fromName: 'Kolmo Construction'
    });

    if (emailSent) {
      console.log('✅ Test email sent successfully!');
      return true;
    } else {
      console.log('❌ Failed to send test email');
      return false;
    }

  } catch (error) {
    console.error('Error in debug test:', error);
    return false;
  }
}

debugQuoteEmail().then(success => {
  console.log(success ? '\n✅ Debug test completed successfully!' : '\n❌ Debug test failed');
  process.exit(success ? 0 : 1);
});