import type { Order, Client, Settings } from "./db";
import { totalAdvance, orderTotal, balanceDue } from "./db";

function dd(n: number) { return String(n).padStart(2, "0"); }
function localDate(iso: string) {
  const d = new Date(iso);
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function usd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }

export function printInvoice(
  order: Order,
  client: Client | undefined,
  settings: Settings,
  invoiceNumber: string,
) {
  const adv      = totalAdvance(order);
  const total    = orderTotal(order);
  const bal      = balanceDue(order);
  const shipping = order.shippingCharge || 0;

  // Description = karats + jewellery type, fallback to full description
  const description = [
    order.productKarats,
    order.jewelleryType.toUpperCase(),
    order.metal !== "Gold" ? order.metal.toUpperCase() : "",
  ].filter(Boolean).join(" ") || `${order.jewelleryType} - ${order.metal}`.toUpperCase();

  const stockId   = order.designNumber || "—";
  const weight    = order.diamondWeight ? `${order.diamondWeight}CT` : "—";
  const itemPrice = order.amount ? usd(order.amount) : "—";
  const itemTotal = order.amount ? usd(order.amount) : "—";

  // Build 10 table rows; first row filled
  const ROWS = 10;
  const tableRows = Array.from({ length: ROWS }, (_, i) => {
    if (i === 0) {
      return `<tr>
        <td class="center">1</td>
        <td class="center">${stockId}</td>
        <td>${description}</td>
        <td class="center">${order.quantity}</td>
        <td class="center">${weight}</td>
        <td class="center">${itemPrice}</td>
        <td class="center">${itemTotal}</td>
      </tr>`;
    }
    return `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
  }).join("\n");

  const qr1Html = settings.invoiceQr1
    ? `<img src="${settings.invoiceQr1}" alt="QR 1" style="width:80px;height:80px;display:block;margin:0 auto;" />`
    : `<div style="width:80px;height:80px;border:2px dashed #999;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center;margin:0 auto;">Upload QR</div>`;

  const qr2Html = settings.invoiceQr2
    ? `<img src="${settings.invoiceQr2}" alt="QR 2" style="width:80px;height:80px;display:block;margin:0 auto;" />`
    : `<div style="width:80px;height:80px;border:2px dashed #999;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center;margin:0 auto;">Upload QR</div>`;

  const stampHtml = settings.invoiceStamp
    ? `<img src="${settings.invoiceStamp}" alt="Stamp" style="width:80px;height:80px;display:block;margin:4px auto;" />`
    : `<div style="width:80px;height:80px;border:2px dashed #999;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center;margin:4px auto;">Upload Stamp</div>`;

  const logoUrl = "/starlink-logo.png";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Invoice ${invoiceNumber} — ${order.orderNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    padding: 28px 32px;
    max-width: 780px;
    margin: 0 auto;
  }
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .logo { height: 56px; width: auto; }
  .company-addr { text-align: right; font-size: 10.5px; line-height: 1.65; }

  /* Divider */
  .divider { border: none; border-top: 2px dashed #bbb; margin: 10px 0 14px; }

  /* Invoice title */
  .inv-title { text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 3px; margin-bottom: 16px; }

  /* To / Invoice Meta */
  .info-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .to-block { font-size: 11px; line-height: 1.7; }
  .to-block .name { font-weight: bold; font-size: 12px; text-transform: uppercase; }
  .meta-box { border: 1px solid #000; font-size: 10.5px; min-width: 210px; }
  .meta-box table { width: 100%; border-collapse: collapse; }
  .meta-box td { padding: 4px 8px; }
  .meta-box td:first-child { font-weight: normal; white-space: nowrap; border-right: 1px solid #000; }
  .meta-box tr:not(:last-child) td { border-bottom: 1px solid #000; }
  .meta-box td:last-child { text-align: right; font-weight: bold; }

  /* Line items table */
  .items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  .items th {
    background: #b8cce4;
    border: 1px solid #888;
    padding: 6px 5px;
    text-align: center;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .items th.desc { text-align: left; }
  .items td {
    border: 1px solid #aaa;
    padding: 5px 5px;
    font-size: 10.5px;
    height: 22px;
    vertical-align: middle;
  }
  .items td.center { text-align: center; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 0; }
  .totals { border-collapse: collapse; min-width: 280px; font-size: 11px; }
  .totals td { padding: 5px 10px; border: 1px solid #aaa; }
  .totals td:first-child { text-align: right; }
  .totals td:last-child { text-align: right; font-weight: normal; min-width: 80px; }
  .totals .bold td { font-weight: bold; font-size: 12px; }

  /* Footer three columns */
  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 22px;
    gap: 12px;
  }
  .footer-col { flex: 1; }
  .footer-col.center-col { text-align: center; display: flex; gap: 14px; justify-content: center; align-items: flex-end; }
  .footer-col.right-col { text-align: center; }
  .qr-block { display: inline-block; text-align: center; }
  .qr-label { font-size: 9px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px; }
  .qr-brand { font-size: 9px; font-style: italic; margin-top: 3px; color: #333; }
  .sig-line { border-top: 1px solid #000; width: 120px; margin-bottom: 4px; }
  .sig-text { font-size: 9.5px; }
  .for-company { font-size: 10px; font-weight: bold; margin-bottom: 4px; }
  .auth-text { font-size: 9.5px; margin-top: 4px; }

  /* Legal */
  .legal { margin-top: 16px; font-size: 9px; color: #333; line-height: 1.6; font-style: italic; }

  /* Thank you */
  .thank-you { text-align: center; font-weight: bold; font-size: 13px; letter-spacing: 1px; margin-top: 14px; padding-top: 10px; border-top: 1px solid #ccc; }

  @media print {
    body { padding: 16px 20px; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>

<!-- Header: logo + address -->
<div class="header">
  <img src="${logoUrl}" alt="Starlink Jewels" class="logo" />
  <div class="company-addr">
    ${settings.invoiceAddress1 || "55 JOHN ST"}<br/>
    ${settings.invoiceAddress2 || "EAST RUTHERFORD"}<br/>
    ${settings.invoiceAddress3 || "NEW JERSEY 07073"}<br/>
    Tel No: ${settings.invoiceTel || ""}<br/>
    Primary: ${settings.invoicePrimary || ""}<br/>
    Email: ${settings.invoiceEmail || ""}
  </div>
</div>

<hr class="divider"/>

<div class="inv-title">INVOICE</div>

<!-- TO block + Invoice meta -->
<div class="info-row">
  <div class="to-block">
    <div class="name">TO: ${(client?.ownerName || client?.companyName || "").toUpperCase()}</div>
    <div>${client?.address || ""}</div>
    <div>${client?.companyName || ""}</div>
    <div>Tel: ${client?.phone || ""}</div>
  </div>
  <div class="meta-box">
    <table>
      <tr><td>Invoice No:</td><td>${invoiceNumber}</td></tr>
      <tr><td>Date:</td><td>${localDate(order.createdAt)}</td></tr>
      <tr><td>Terms:</td><td>${settings.invoiceTerms || "COD"}</td></tr>
    </table>
  </div>
</div>

<!-- Line items -->
<table class="items">
  <thead>
    <tr>
      <th style="width:44px">SR NO</th>
      <th style="width:66px">STOCK ID</th>
      <th class="desc" style="text-align:left">DESCRIPTION</th>
      <th style="width:44px">PCS</th>
      <th style="width:66px">WEIGHT</th>
      <th style="width:90px">PRICE<br/>USD / HKD</th>
      <th style="width:70px">TOTAL</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<!-- Totals -->
<div class="totals-wrap">
  <table class="totals">
    <tr>
      <td>Shipping Charges</td>
      <td>${shipping > 0 ? usd(shipping) : "—"}</td>
    </tr>
    <tr class="bold">
      <td>Total Amount</td>
      <td>${usd(total)}</td>
    </tr>
    <tr>
      <td>Deposit Payment</td>
      <td>${adv > 0 ? usd(adv) : "—"}</td>
    </tr>
    <tr>
      <td><strong>Balance Due</strong></td>
      <td><strong>${bal > 0 ? usd(bal) : "0"}</strong></td>
    </tr>
  </table>
</div>

<!-- Footer -->
<div class="footer-row">
  <!-- Left: chop / signature -->
  <div class="footer-col">
    <div style="margin-top:50px;">
      <div class="sig-line"></div>
      <div class="sig-text">Chop or signature.</div>
    </div>
  </div>

  <!-- Centre: two QR codes -->
  <div class="footer-col center-col">
    <div class="qr-block">
      <div class="qr-label">SCAN TO PAY</div>
      ${qr1Html}
      <div class="qr-brand">venmo</div>
    </div>
    <div class="qr-block">
      <div class="qr-label">SCAN TO PAY</div>
      ${qr2Html}
      <div class="qr-brand">venmo</div>
    </div>
  </div>

  <!-- Right: company stamp -->
  <div class="footer-col right-col">
    <div class="for-company">For ${(settings.companyName || "STARLINK JEWELS").toUpperCase()} INC</div>
    ${stampHtml}
    <div class="auth-text">Chop &amp; Authorized Signature</div>
  </div>
</div>

<!-- Legal text -->
<div class="legal">
  This Items Here in Invoiced Has Been Purchased from Legal Sources, Not Involved in Funding Conflict and In Compliance with United Nations Resolutions.<br/>
  The Seller Here by Guaranteed This Item Are Conflict Free and Not Involved in Any Money Laundering, Based On Personal Knowledge and Written Guarantied Provided By The Supplier of This Item.
</div>

<div class="thank-you">THANK YOU FOR YOUR BUSINESS</div>

<script>
  window.onload = function() {
    window.focus();
    window.print();
  };
</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=820,height=1100");
  if (!w) { alert("Please allow popups to print/download the invoice."); return; }
  w.document.write(html);
  w.document.close();
}
