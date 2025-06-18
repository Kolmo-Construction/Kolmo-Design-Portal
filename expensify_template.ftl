<#--
  Corrected and Hardened Expensify JSON Export Template
  - Wrapped in <#compress> to remove extraneous whitespace for clean, minified JSON.
  - Added null-value defaults to ALL fields to prevent template processing errors.
    e.g., (field!0) for numbers, (field!'') for strings.
  - Added common, useful fields like 'currency' and 'receiptUrl'.
-->
<#compress>
[<#list reports as report>
  {
    "reportID": "${(report.reportID!'')?js_string}",
    "reportName": "${(report.reportName!'')?js_string}",
    "status": "${(report.status!'')?js_string}",
    "total": ${(report.total!0)?c},
    "currency": "${(report.currency!'USD')?js_string}",
    "expenses": [<#list report.transactionList as expense>
      {
        "transactionID": "${(expense.transactionID!'')?js_string}",
        "amount": ${(expense.amount!0)?c},
        "category": "${(expense.category!'')?js_string}",
        "tag": "${(expense.tag!'')?js_string}",
        "merchant": "${(expense.merchant!'')?js_string}",
        "comment": "${(expense.comment!'')?js_string}",
        "created": "${(expense.created!'')?js_string}",
        "modified": "${(expense.modified!'')?js_string}",
        "receipt": {
          "filename": "${(expense.receiptFilename!'')?js_string}",
          "url": "${(expense.receiptUrl!'')?js_string}"
        }
      }<#if expense_has_next>,</#if>
    </#list>]
  }<#if report_has_next>,</#if>
</#list>]
</#compress>