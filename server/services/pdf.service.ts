import puppeteer from 'puppeteer';
import { storage } from '../storage';
import { Invoice, Project } from '../../shared/schema';

export async function generateInvoicePdf(invoiceId: number): Promise<Buffer> {
  const invoice = await storage.invoices.getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Fetch project details for the invoice
  const project = await storage.projects.getProjectById(invoice.projectId);
  if (!project) {
    throw new Error('Project not found for invoice');
  }

  // Create professional invoice HTML template
  const htmlContent = generateInvoiceHTML(invoice, project);

  // Launch Puppeteer and create PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  });
  
  await browser.close();
  return Buffer.from(pdfBuffer);
}

function generateInvoiceHTML(invoice: Invoice, project: Project): string {
  const issueDate = new Date(invoice.issueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const amount = Number(invoice.amount);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #fff;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 50px;
          border-bottom: 3px solid #d8973c;
          padding-bottom: 30px;
        }

        .company-info {
          flex: 1;
        }

        .company-name {
          font-size: 32px;
          font-weight: bold;
          color: #3d4f52;
          margin-bottom: 10px;
        }
        
        .company-tagline {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 20px;
        }
        
        .company-details {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }
        
        .invoice-title {
          text-align: right;
          flex: 1;
        }
        
        .invoice-title h1 {
          font-size: 48px;
          color: #3d4f52;
          margin-bottom: 10px;
        }
        
        .invoice-number {
          font-size: 18px;
          color: #64748b;
          margin-bottom: 5px;
        }
        
        .invoice-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
        }
        
        .bill-to, .invoice-details {
          background: #f8fafc;
          padding: 25px;
          border-radius: 8px;
          border-left: 4px solid #d8973c;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .client-name {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 10px;
        }
        
        .project-name {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 5px;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .detail-label {
          color: #64748b;
          font-weight: 500;
        }
        
        .detail-value {
          color: #1e293b;
          font-weight: 600;
        }
        
        .invoice-items {
          margin: 40px 0;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .items-table th {
          background: #3d4f52;
          color: white;
          padding: 20px 15px;
          text-align: left;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .items-table td {
          padding: 20px 15px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }
        
        .items-table tr:last-child td {
          border-bottom: none;
        }
        
        .description-cell {
          font-weight: 500;
          color: #1e293b;
        }
        
        .amount-cell {
          text-align: right;
          font-weight: 600;
          color: #1e293b;
        }
        
        .total-section {
          margin-top: 30px;
          text-align: right;
        }
        
        .total-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 15px;
          font-size: 16px;
        }
        
        .total-label {
          width: 200px;
          text-align: right;
          padding-right: 20px;
          color: #64748b;
          font-weight: 500;
        }
        
        .total-amount {
          width: 150px;
          text-align: right;
          color: #1e293b;
          font-weight: 600;
        }
        
        .grand-total {
          border-top: 2px solid #d8973c;
          padding-top: 15px;
          margin-top: 15px;
        }

        .grand-total .total-label,
        .grand-total .total-amount {
          font-size: 24px;
          font-weight: bold;
          color: #d8973c;
        }
        
        .payment-info {
          margin-top: 50px;
          padding: 25px;
          background: #f1f5f9;
          border-radius: 8px;
          border-left: 4px solid #10b981;
        }
        
        .payment-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 15px;
        }
        
        .payment-details {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
        }
        
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }
        
        .status-paid {
          background: #d1fae5;
          color: #065f46;
        }
        
        .status-overdue {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .footer {
          margin-top: 60px;
          padding-top: 30px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">Kolmo Construction</div>
            <div class="company-tagline">Technology-Driven Home Remodeling</div>
            <div class="company-details">
              4018 NE 125th St<br>
              Seattle, WA 98125<br>
              (206) 410-5100<br>
              projects@kolmo.io<br>
              www.kolmo.io
            </div>
          </div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <div class="invoice-number">#${invoice.invoiceNumber}</div>
            <div class="status-badge status-${invoice.status}">
              ${invoice.status.toUpperCase()}
            </div>
          </div>
        </div>
        
        <!-- Invoice Meta Information -->
        <div class="invoice-meta">
          <div class="bill-to">
            <div class="section-title">Bill To</div>
            <div class="client-name">Client</div>
            <div class="project-name">Project: ${project.name}</div>
            <div style="color: #64748b; font-size: 14px; margin-top: 10px;">${project.address}, ${project.city}, ${project.state} ${project.zipCode}</div>
          </div>
          
          <div class="invoice-details">
            <div class="section-title">Invoice Details</div>
            <div class="detail-row">
              <span class="detail-label">Issue Date:</span>
              <span class="detail-value">${issueDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Due Date:</span>
              <span class="detail-value">${dueDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Project ID:</span>
              <span class="detail-value">#${project.id}</span>
            </div>
          </div>
        </div>
        
        <!-- Invoice Items -->
        <div class="invoice-items">
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60%;">Description</th>
                <th style="width: 20%;">Quantity</th>
                <th style="width: 20%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="description-cell">
                  <strong>Project Services</strong><br>
                  <span style="color: #64748b; font-size: 13px;">
                    Construction services for ${project.name}
                    ${invoice.description ? `<br>${invoice.description}` : ''}
                  </span>
                </td>
                <td style="text-align: center;">1</td>
                <td class="amount-cell">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Total Section -->
        <div class="total-section">
          <div class="total-row grand-total">
            <div class="total-label">Total Amount Due:</div>
            <div class="total-amount">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        
        <!-- Payment Information -->
        <div class="payment-info">
          <div class="payment-title">Payment Information</div>
          <div class="payment-details">
            Payment is due within 30 days of invoice date. Please include invoice number #${invoice.invoiceNumber} with your payment.
            <br><br>
            <strong>Questions?</strong> Contact us at contact@kolmo.io or through your project portal.
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          Thank you for choosing KOLMO for your construction needs.
        </div>
      </div>
    </body>
    </html>
  `;
}