/**
 * Test the exact template format from the attached file
 */

async function testExactTemplateFormat() {
  console.log('=== Testing Exact Template Format ===\n');
  
  const partnerUserID = process.env.EXPENSIFY_PARTNER_USER_ID || '';
  const partnerUserSecret = process.env.EXPENSIFY_PARTNER_USER_SECRET || '';
  const baseURL = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';
  
  // The exact template from the attached file
  const exportTemplate = '<#compress>[<#list reports as report>{"reportID":"${(report.reportID!\'\')?js_string}","reportName":"${(report.reportName!\'\')?js_string}","status":"${(report.status!\'\')?js_string}","total":${(report.total!0)?c},"currency":"${(report.currency!\'USD\')?js_string}","expenses":[<#list report.transactionList as expense>{"transactionID":"${(expense.transactionID!\'\')?js_string}","amount":${(expense.amount!0)?c},"category":"${(expense.category!\'\')?js_string}","tag":"${(expense.tag!\'\')?js_string}","merchant":"${(expense.merchant!\'\')?js_string}","comment":"${(expense.comment!\'\')?js_string}","created":"${(expense.created!\'\')?js_string}","modified":"${(expense.modified!\'\')?js_string}"<#if expense.receipt??,"receipt":{"receiptID":"${(expense.receipt.receiptID!\'\')?js_string}","filename":"${(expense.receipt.filename!\'\')?js_string}"}</#if>}<#if expense_has_next>,</#if></#list>]}<#if report_has_next>,</#if></#list>]</#compress>';

  // The exact requestJobDescription structure from the attached file
  const requestJobDescription = {
    type: "file",
    credentials: {
      partnerUserID: partnerUserID,
      partnerUserSecret: partnerUserSecret
    },
    onReceive: {
      immediateResponse: ["returnRandomFileName"]
    },
    inputSettings: {
      type: "combinedReportData",
      filters: {
        reportState: "APPROVED",
        startDate: "2024-01-01",
        endDate: "2025-06-18"
      }
    },
    outputSettings: {
      fileExtension: "json"
    },
    // Include template within the jobDescription as shown in the attached file
    template: exportTemplate
  };

  console.log('1. Testing with template inside requestJobDescription...');
  
  const formData = new URLSearchParams();
  formData.append('requestJobDescription', JSON.stringify(requestJobDescription));

  try {
    const response = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}...`);
    
    if (responseText.includes('Authentication error')) {
      console.log('   Authentication issue with template inside jobDescription');
    } else if (responseText.includes('No Template Submitted')) {
      console.log('   Template not recognized inside jobDescription');
    } else {
      console.log('   Success! Template working correctly');
      return;
    }
  } catch (error) {
    console.log(`   Request failed: ${error}`);
  }

  console.log('\n2. Testing with template as separate parameter...');
  
  // Remove template from jobDescription
  const jobDescriptionWithoutTemplate = {
    type: "file",
    credentials: {
      partnerUserID: partnerUserID,
      partnerUserSecret: partnerUserSecret
    },
    onReceive: {
      immediateResponse: ["returnRandomFileName"]
    },
    inputSettings: {
      type: "combinedReportData",
      filters: {
        reportState: "APPROVED",
        startDate: "2024-01-01",
        endDate: "2025-06-18"
      }
    },
    outputSettings: {
      fileExtension: "json"
    }
  };

  const formData2 = new URLSearchParams();
  formData2.append('requestJobDescription', JSON.stringify(jobDescriptionWithoutTemplate));
  formData2.append('template', exportTemplate);

  try {
    const response = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData2.toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}...`);
    
    if (responseText.includes('Authentication error')) {
      console.log('   Authentication issue with separate template parameter');
    } else if (responseText.includes('No Template Submitted')) {
      console.log('   Template not recognized as separate parameter');
    } else {
      console.log('   Success! Template working correctly');
    }
  } catch (error) {
    console.log(`   Request failed: ${error}`);
  }

  console.log('\n=== Template Format Test Complete ===');
}

testExactTemplateFormat().catch(console.error);