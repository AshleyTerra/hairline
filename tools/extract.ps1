# Extracts real data from the restored MySalon LocalDB into raw JSON.
# Output contains real client PII and is written to the scratchpad only - never committed.

param(
  [string]$OutDir = "C:\temp\claude\c--Data-OneDrive---Terra-Group-Applications-Hairline\6305bd13-c82c-4c05-b471-9115eecd7529\scratchpad\extract"
)

$connStr = "Server=(localdb)\MySalonRestore;Database=MySalon;Integrated Security=true;TrustServerCertificate=true;"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Add-Type -AssemblyName System.Data

$conn = New-Object System.Data.SqlClient.SqlConnection $connStr
$conn.Open()

function Export-Json {
  param([string]$Name, [string]$Sql)
  $out = Join-Path $OutDir "$Name.raw.json"
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $Sql
  $cmd.CommandTimeout = 300
  $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
  $table = New-Object System.Data.DataTable
  [void]$adapter.Fill($table)

  $rows = foreach ($r in $table.Rows) {
    $o = [ordered]@{}
    foreach ($c in $table.Columns) {
      $v = $r[$c.ColumnName]
      $o[$c.ColumnName] = if ($v -is [System.DBNull]) { $null } else { $v }
    }
    [pscustomobject]$o
  }

  $json = if ($null -eq $rows) { "[]" } else { ConvertTo-Json @($rows) -Depth 5 -Compress }
  Set-Content -Path $out -Value $json -Encoding utf8 -NoNewline
  Write-Host ("{0,-24} {1,7} rows" -f $Name, $table.Rows.Count)
}

# Reference date = the last REAL trading day. A single stray invoice dated weeks
# after the backup would otherwise anchor every window to an empty period.
Export-Json "meta" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT TOP 1 CONVERT(varchar(10), @maxd, 120) AS maxInvoiceDate,
       (SELECT COUNT(*) FROM Invoices) AS totalInvoices,
       (SELECT COUNT(*) FROM Clients WHERE Active=1) AS activeClients,
       (SELECT CompanyName FROM CompanyInfo) AS companyName
FROM Invoices
"@

Export-Json "staff" @"
SELECT StylistID AS id, FirstName AS firstName, Surname AS surname,
       CONVERT(varchar(10), CommencementDate, 120) AS startDate,
       ISNULL(IsReceptionst,0) AS isReception, ISNULL(IsOnAppDiary,0) AS onDiary
FROM Stylists WHERE Active=1
"@

Export-Json "services" @"
SELECT s.StockID AS id, s.DeptID AS deptId, d.Dept AS dept, s.Description AS name,
       s.RSP AS price, s.Cost AS cost, s.AppMins AS mins
FROM Stock s LEFT JOIN Departments d ON d.DeptID = s.DeptID
WHERE s.ServiceType = 'S' AND s.RSP > 0
"@

Export-Json "products" @"
SELECT s.StockID AS id, s.DeptID AS deptId, d.Dept AS dept, s.Description AS name,
       s.Vendor AS vendor, s.ServiceType AS kind, s.Cost AS cost, s.RSP AS price,
       s.QtyOnHand AS qty, s.ReorderLevel AS reorder, s.Barcode AS barcode, s.ml AS ml
FROM Stock s LEFT JOIN Departments d ON d.DeptID = s.DeptID
WHERE s.ServiceType IN ('R','Stock Item')
"@

Export-Json "clients" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT TOP 750 c.ClientID AS id, c.FirstName AS fn, c.Surname AS sn, c.Tel1 AS tel,
       c.Email AS email, CONVERT(varchar(10), c.BirthDate, 120) AS bday,
       CONVERT(varchar(10), c.FirstVisit, 120) AS firstVisit,
       c.StylistID AS prefStylist, CAST(c.Notes AS varchar(500)) AS notes,
       ISNULL(c.MedicalCondition,0) AS med, ISNULL(c.Gender,0) AS gender,
       CONVERT(varchar(10), x.lastVisit, 120) AS lastVisit,
       x.visitCount, x.lifetimeSpend
FROM Clients c
JOIN (SELECT ClientID, MAX([Date]) AS lastVisit, COUNT(*) AS visitCount,
             SUM(Total) AS lifetimeSpend
      FROM Invoices WHERE [Date] < @maxd GROUP BY ClientID) x ON x.ClientID = c.ClientID
WHERE c.Active = 1
ORDER BY x.lastVisit DESC
"@

Export-Json "invoices13m" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT i.InvoiceID AS id, i.ClientID AS clientId,
       CONVERT(varchar(19), i.[Date], 120) AS date, i.Total AS total,
       ISNULL(i.PaidCash,0) AS cash, ISNULL(i.PaidCard,0) AS card,
       ISNULL(i.PaidEFT,0) AS eft, ISNULL(i.PaidToPay,0) AS toPay,
       ISNULL(i.PaidVoucher,0) AS voucher,
       ii.Description AS descr, ii.Price AS price, ISNULL(ii.Qty,1) AS qty,
       ISNULL(ii.Disc,0) AS disc, ii.StylistID AS stylistId, ii.ServiceType AS kind
FROM Invoices i
JOIN InvoiceItems ii ON ii.InvoiceID = i.InvoiceID
WHERE i.[Date] >= DATEADD(month, -13, @maxd)
  AND i.ClientID IN (
    SELECT TOP 750 c.ClientID FROM Clients c
    JOIN (SELECT ClientID, MAX([Date]) lv FROM Invoices GROUP BY ClientID) x
      ON x.ClientID = c.ClientID
    WHERE c.Active = 1 ORDER BY x.lv DESC)
"@

Export-Json "revenueByYear" @"
SELECT YEAR([Date]) AS yr, COUNT(DISTINCT InvoiceID) AS invoices,
       CAST(SUM(Total) AS decimal(14,2)) AS revenue
FROM Invoices GROUP BY YEAR([Date])
"@

Export-Json "revenueByMonth" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT CONVERT(varchar(7), [Date], 120) AS ym, COUNT(*) AS invoices,
       CAST(SUM(Total) AS decimal(14,2)) AS revenue
FROM Invoices
WHERE [Date] >= DATEADD(month, -24, @maxd)
GROUP BY CONVERT(varchar(7), [Date], 120)
"@

Export-Json "topServices" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT TOP 12 ii.Description AS name, COUNT(*) AS times,
       CAST(SUM(ii.Price * ISNULL(ii.Qty,1)) AS decimal(14,2)) AS revenue
FROM InvoiceItems ii JOIN Invoices i ON i.InvoiceID = ii.InvoiceID
WHERE i.[Date] >= DATEADD(month, -12, @maxd)
  AND ii.ServiceType = 'S'
GROUP BY ii.Description ORDER BY SUM(ii.Price * ISNULL(ii.Qty,1)) DESC
"@

Export-Json "topProducts" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT TOP 12 ii.Description AS name, COUNT(*) AS times,
       CAST(SUM(ii.Price * ISNULL(ii.Qty,1)) AS decimal(14,2)) AS revenue
FROM InvoiceItems ii JOIN Invoices i ON i.InvoiceID = ii.InvoiceID
WHERE i.[Date] >= DATEADD(month, -12, @maxd)
  AND ii.ServiceType = 'R'
GROUP BY ii.Description ORDER BY SUM(ii.Price * ISNULL(ii.Qty,1)) DESC
"@

Export-Json "stylistPerf" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT ii.StylistID AS stylistId,
       CAST(SUM(CASE WHEN ii.ServiceType='S' THEN ii.Price * ISNULL(ii.Qty,1) ELSE 0 END) AS decimal(14,2)) AS serviceRevenue,
       CAST(SUM(CASE WHEN ii.ServiceType='R' THEN ii.Price * ISNULL(ii.Qty,1) ELSE 0 END) AS decimal(14,2)) AS retailRevenue,
       COUNT(DISTINCT ii.InvoiceID) AS invoices
FROM InvoiceItems ii JOIN Invoices i ON i.InvoiceID = ii.InvoiceID
WHERE i.[Date] >= DATEADD(month, -12, @maxd)
  AND ii.StylistID IN (SELECT StylistID FROM Stylists WHERE Active=1)
GROUP BY ii.StylistID
"@

Export-Json "stylistMonthly" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT ii.StylistID AS stylistId, CONVERT(varchar(7), i.[Date], 120) AS ym,
       CAST(SUM(ii.Price * ISNULL(ii.Qty,1)) AS decimal(14,2)) AS revenue
FROM InvoiceItems ii JOIN Invoices i ON i.InvoiceID = ii.InvoiceID
WHERE i.[Date] >= DATEADD(month, -12, @maxd)
  AND ii.StylistID IN (SELECT StylistID FROM Stylists WHERE Active=1)
GROUP BY ii.StylistID, CONVERT(varchar(7), i.[Date], 120)
"@

# Busiest trading day in the final fortnight, so "today" in the demo sits close
# to the end of the data and client visit dates stay in the past.
Export-Json "demoDay" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT TOP 1 CONVERT(varchar(10), [Date], 120) AS d, COUNT(*) AS n,
       CAST(SUM(Total) AS decimal(14,2)) AS t
FROM Invoices
WHERE [Date] < CAST(@maxd AS date)
  AND [Date] >= DATEADD(day, -14, @maxd)
GROUP BY CONVERT(varchar(10), [Date], 120), CAST([Date] AS date)
ORDER BY SUM(Total) DESC
"@

Export-Json "tips12m" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT t.StylistID AS stylistId, CAST(SUM(t.TipAmount) AS decimal(14,2)) AS total,
       COUNT(*) AS times
FROM StylistTips t JOIN Invoices i ON i.InvoiceID = t.InvoiceID
WHERE i.[Date] >= DATEADD(month, -12, @maxd)
GROUP BY t.StylistID
"@

Export-Json "subs12m" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT StylistID AS stylistId, CONVERT(varchar(10), StaffSubDate, 120) AS date,
       Amount AS amount, Description AS descr
FROM StaffSubs
WHERE StaffSubDate >= DATEADD(month, -12, @maxd)
"@

Export-Json "cashupRecent" @"
SELECT TOP 30 CONVERT(varchar(10), CashupDate, 120) AS date,
       ISNULL(TotalCard,0) AS card, ISNULL(TotalEFT,0) AS eft,
       ISNULL(TotalVoucher,0) AS voucher, ISNULL([Float],0) AS float
FROM Cashup ORDER BY CashupDate DESC
"@

Export-Json "clockRecent" @"
SELECT TOP 200 StylistID AS stylistId,
       CONVERT(varchar(10), Clock_In_Date, 120) AS day,
       CONVERT(varchar(19), Clock_In, 120) AS clockIn,
       CONVERT(varchar(19), Clock_Out, 120) AS clockOut
FROM FingerprintClock
WHERE Clock_In IS NOT NULL
ORDER BY Clock_In_Date DESC
"@

Export-Json "tipsAllTime" @"
SELECT t.StylistID AS stylistId, CAST(SUM(t.TipAmount) AS decimal(14,2)) AS total,
       COUNT(*) AS times, CONVERT(varchar(10), MAX(i.[Date]), 120) AS lastTip
FROM StylistTips t JOIN Invoices i ON i.InvoiceID = t.InvoiceID
GROUP BY t.StylistID
"@

Export-Json "subsAllTime" @"
SELECT StylistID AS stylistId, CAST(SUM(Amount) AS decimal(14,2)) AS total, COUNT(*) AS times
FROM StaffSubs GROUP BY StylistID
"@

Export-Json "dailyRevenue90" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT CONVERT(varchar(10), [Date], 120) AS d, COUNT(*) AS invoices,
       CAST(SUM(Total) AS decimal(14,2)) AS revenue
FROM Invoices
WHERE [Date] >= DATEADD(day, -90, @maxd)
GROUP BY CONVERT(varchar(10), [Date], 120)
"@

Export-Json "mixByYear" @"
SELECT YEAR(i.[Date]) AS yr,
       CAST(SUM(CASE WHEN ii.ServiceType='S' THEN ii.Price*ISNULL(ii.Qty,1) ELSE 0 END) AS decimal(14,2)) AS service,
       CAST(SUM(CASE WHEN ii.ServiceType='R' THEN ii.Price*ISNULL(ii.Qty,1) ELSE 0 END) AS decimal(14,2)) AS retail
FROM InvoiceItems ii JOIN Invoices i ON i.InvoiceID = ii.InvoiceID
WHERE i.[Date] >= '2022-01-01'
GROUP BY YEAR(i.[Date])
"@

Export-Json "paymentMix12m" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT CAST(SUM(ISNULL(PaidCash,0)) AS decimal(14,2)) AS cash,
       CAST(SUM(ISNULL(PaidCard,0)) AS decimal(14,2)) AS card,
       CAST(SUM(ISNULL(PaidEFT,0)) AS decimal(14,2)) AS eft,
       CAST(SUM(ISNULL(PaidToPay,0)) AS decimal(14,2)) AS toPay,
       CAST(SUM(ISNULL(PaidVoucher,0)) AS decimal(14,2)) AS voucher
FROM Invoices
WHERE [Date] >= DATEADD(month, -12, @maxd)
"@

Export-Json "demoDayInvoices" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT i.InvoiceID AS id, i.ClientID AS clientId,
       CONVERT(varchar(19), i.[Date], 120) AS date, i.Total AS total,
       ISNULL(i.PaidCash,0) AS cash, ISNULL(i.PaidCard,0) AS card,
       ISNULL(i.PaidEFT,0) AS eft, ISNULL(i.PaidToPay,0) AS toPay,
       ISNULL(i.PaidVoucher,0) AS voucher,
       ii.Description AS descr, ii.Price AS price, ISNULL(ii.Qty,1) AS qty,
       ISNULL(ii.Disc,0) AS disc, ii.StylistID AS stylistId, ii.ServiceType AS kind
FROM Invoices i JOIN InvoiceItems ii ON ii.InvoiceID = i.InvoiceID
WHERE CAST(i.[Date] AS date) = (
  SELECT TOP 1 CAST([Date] AS date) FROM Invoices
  WHERE [Date] < CAST(@maxd AS date)
    AND [Date] >= DATEADD(day, -14, @maxd)
  GROUP BY CAST([Date] AS date) ORDER BY SUM(Total) DESC)
"@

Export-Json "demoDayClients" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT DISTINCT c.ClientID AS id, c.FirstName AS fn, c.Surname AS sn, c.Tel1 AS tel,
       c.StylistID AS prefStylist,
       CONVERT(varchar(10), c.FirstVisit, 120) AS firstVisit
FROM Clients c WHERE c.ClientID IN (
  SELECT i.ClientID FROM Invoices i
  WHERE CAST(i.[Date] AS date) = (
    SELECT TOP 1 CAST([Date] AS date) FROM Invoices
    WHERE [Date] < CAST(@maxd AS date)
      AND [Date] >= DATEADD(day, -14, @maxd)
    GROUP BY CAST([Date] AS date) ORDER BY SUM(Total) DESC))
"@

Export-Json "stockHealth" @"
SELECT COUNT(*) AS total,
       SUM(CASE WHEN QtyOnHand < 0 THEN 1 ELSE 0 END) AS negative,
       SUM(CASE WHEN QtyOnHand = 0 THEN 1 ELSE 0 END) AS zero,
       SUM(CASE WHEN QtyOnHand > 0 THEN 1 ELSE 0 END) AS positive,
       CAST(SUM(CASE WHEN QtyOnHand > 0 THEN QtyOnHand * Cost ELSE 0 END) AS decimal(14,2)) AS valueOnHand
FROM Stock WHERE ServiceType IN ('R','Stock Item')
"@

Export-Json "clientHealth" @"
SELECT COUNT(*) AS activeClients,
       SUM(CASE WHEN BirthDate IS NOT NULL THEN 1 ELSE 0 END) AS withBirthday,
       SUM(CASE WHEN Email IS NOT NULL AND Email <> '' THEN 1 ELSE 0 END) AS withEmail,
       SUM(CASE WHEN Tel1 IS NOT NULL AND Tel1 <> '' THEN 1 ELSE 0 END) AS withPhone
FROM Clients WHERE Active = 1
"@

Export-Json "retention" @"
DECLARE @maxd datetime = (SELECT DATEADD(day,1,MAX(d)) FROM (SELECT CAST([Date] AS date) d, COUNT(*) n FROM Invoices GROUP BY CAST([Date] AS date)) t WHERE n >= 5);
SELECT
  SUM(CASE WHEN lv >= DATEADD(day,-90,@maxd) THEN 1 ELSE 0 END) AS active90,
  SUM(CASE WHEN lv < DATEADD(day,-90,@maxd) AND lv >= DATEADD(day,-365,@maxd) THEN 1 ELSE 0 END) AS lapsed,
  SUM(CASE WHEN visits = 1 THEN 1 ELSE 0 END) AS oneTimers,
  SUM(CASE WHEN visits >= 10 THEN 1 ELSE 0 END) AS loyal10plus
FROM (SELECT ClientID, MAX([Date]) AS lv, COUNT(*) AS visits
      FROM Invoices WHERE [Date] < @maxd GROUP BY ClientID) t
"@

$conn.Close()
Write-Host "`nRaw extract written to: $OutDir" -ForegroundColor Green
