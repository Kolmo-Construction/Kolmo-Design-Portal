[
<#list reports as report>
{
  "reportID": "${report.reportID}",
  "reportName": "${report.reportName?js_string}",
  "status": "${report.status?js_string}",
  "total": ${report.total?c},
  "expenses": [
    <#list report.transactionList as expense>
    {
      "transactionID": "${expense.transactionID}",
      "amount": ${expense.amount?c},
      "category": "${(expense.category!'')?js_string}",
      "tag": "${(expense.tag!'')?js_string}",
      "merchant": "${(expense.merchant!'')?js_string}",
      "comment": "${(expense.comment!'')?js_string}",
      "created": "${expense.created}",
      "modified": "${expense.modified}",
      "receipt": {
        "filename": "${(expense.receiptFilename!'')?js_string}"
      }
    }<#if expense_has_next>,</#if>
    </#list>
  ]
}<#if report_has_next>,</#if>
</#list>
]