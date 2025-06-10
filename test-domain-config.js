// Test domain configuration
async function testDomainConfig() {
  // Simulate production environment
  process.env.NODE_ENV = 'production';
  process.env.REPLIT_SLUG = 'test';
  
  // Import the domain config
  const domainConfig = await import('./server/domain.config.ts');
  
  const baseUrl = domainConfig.getBaseUrl();
  console.log('Base URL in production:', baseUrl);
  
  const paymentUrl = domainConfig.generateUrl('/payment/pi_test123_secret_abc');
  console.log('Generated payment URL:', paymentUrl);
  
  // Verify it uses the correct domain
  if (paymentUrl.includes('portal.kolmo.design')) {
    console.log('✅ Domain configuration is correct');
  } else {
    console.log('❌ Domain configuration needs fixing');
  }
}

testDomainConfig().catch(console.error);