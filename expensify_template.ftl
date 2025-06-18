[
<#list reports as report>
  {
    "reportID": "${report.reportID}",
    "reportName": "${report.reportName}",
    "status": "${report.status}",
    "total": ${report.total},
    "expenses": [
      <#list report.transactionList as expense>
      {
        "transactionID": "${expense.transactionID}",
        "amount": ${expense.amount},
        "category": "${expense.category!''}",
        "tag": "${expense.tag!''}",
        "merchant": "${expense.merchant!''}",
        "comment": "${expense.comment!''}",
        "created": "${expense.created}",
        "modified": "${expense.modified}"
      }<#if expense_has_next>,</#if>
      </#list>
    ]
  }<#if report_has_next>,</#if>
</#list>
]