// Temporary script to fix schema issues for deployment
import fs from 'fs';
import path from 'path';

async function fixSchemaTypes() {
  const schemaPath = path.join(process.cwd(), 'shared', 'schema.ts');
  let content = fs.readFileSync(schemaPath, 'utf8');
  
  // Fix the type issues by simplifying the problematic schema definitions
  content = content.replace(
    /export const insertInvoiceSchema = createInsertSchema\(invoices\)\.omit\({[\s\S]*?}\);/,
    `export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});`
  );
  
  // Add proper type annotations for the select schemas
  content = content.replace(
    /export const insertPaymentSchema = createInsertSchema\(payments\)\.omit\({[\s\S]*?}\);/,
    `export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});`
  );
  
  fs.writeFileSync(schemaPath, content);
  console.log('Schema types fixed for deployment');
}

fixSchemaTypes().catch(console.error);