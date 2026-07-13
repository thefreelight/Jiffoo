/**
 * Digital Delivery Email Template (Task 7.1.2)
 *
 * Generates HTML email content for digital goods delivery.
 * Supports eSIM QR codes, redemption codes, download links, and product codes.
 */

export interface DigitalDeliveryEmailItem {
  productName: string;
  quantity: number;
  fulfillmentStatus: string | null;
  fulfillmentData: Record<string, unknown> | null;
}

export interface DigitalDeliveryEmailData {
  orderNumber: string;
  customerEmail: string;
  storeName: string;
  items: DigitalDeliveryEmailItem[];
}

/**
 * Extract digital delivery items from order items.
 */
export function extractDigitalItems(
  items: DigitalDeliveryEmailItem[],
): DigitalDeliveryEmailItem[] {
  return items.filter(item => {
    if (!item.fulfillmentData) return false;
    const data = item.fulfillmentData;
    return Boolean(
      data.qrCodeContent || data.cardUid || data.planId ||
      data.downloadUrl || data.redemptionCode || data.productCode
    );
  });
}

/**
 * Render a single digital delivery item as HTML.
 */
function renderItem(item: DigitalDeliveryEmailItem): string {
  const data = item.fulfillmentData || {};
  const isEsim = Boolean(data.qrCodeContent);
  const isCard = Boolean(data.cardUid);
  const isDownload = Boolean(data.downloadUrl);
  const productCode = data.productCode as string | undefined;

  let deliveryHtml = '';

  if (isEsim) {
    deliveryHtml = `
      <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin-top:12px;">
        <p style="font-size:11px;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">QR Code</p>
        <p style="font-size:14px;color:#495057;margin:0;">Scan the QR code from your order page to activate your eSIM.</p>
        ${data.planId ? `<p style="font-size:12px;color:#6c757d;margin:4px 0 0 0;font-family:monospace;">Plan: ${escapeHtml(String(data.planId))}</p>` : ''}
      </div>`;
  } else if (isCard) {
    deliveryHtml = `
      <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin-top:12px;">
        <p style="font-size:11px;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">Redemption Code</p>
        <code style="font-size:16px;font-weight:bold;color:#212529;background:#e9ecef;padding:8px 12px;border-radius:6px;display:inline-block;word-break:break-all;">${escapeHtml(String(data.cardUid))}</code>
      </div>`;
  } else if (isDownload) {
    deliveryHtml = `
      <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin-top:12px;">
        <p style="font-size:11px;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">Download</p>
        <a href="${escapeHtml(String(data.downloadUrl))}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Download File</a>
      </div>`;
  } else if (productCode) {
    deliveryHtml = `
      <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin-top:12px;">
        <p style="font-size:11px;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">Product Code</p>
        <code style="font-size:14px;font-weight:bold;color:#212529;background:#e9ecef;padding:8px 12px;border-radius:6px;display:inline-block;word-break:break-all;">${escapeHtml(productCode)}</code>
      </div>`;
  }

  return `
    <div style="border-bottom:1px solid #e9ecef;padding:16px 0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <p style="font-size:15px;font-weight:600;color:#212529;margin:0;">${escapeHtml(item.productName)}</p>
          <p style="font-size:12px;color:#6c757d;margin:4px 0 0 0;">Qty: ${item.quantity}</p>
        </div>
        ${item.fulfillmentStatus ? `<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${item.fulfillmentStatus === 'delivered' ? '#198754' : '#0d6efd'};background:${item.fulfillmentStatus === 'delivered' ? '#d1e7dd' : '#cfe2ff'};padding:4px 8px;border-radius:4px;">${escapeHtml(item.fulfillmentStatus)}</span>` : ''}
      </div>
      ${deliveryHtml}
    </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate the full HTML email for digital delivery.
 */
export function renderDigitalDeliveryEmail(data: DigitalDeliveryEmailData): { html: string; text: string; subject: string } {
  const digitalItems = extractDigitalItems(data.items);

  if (digitalItems.length === 0) {
    return {
      html: '',
      text: '',
      subject: '',
    };
  }

  const subject = `Your digital purchases from ${data.storeName} — Order #${data.orderNumber}`;

  const itemsHtml = digitalItems.map(renderItem).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:24px 32px;">
              <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">Your Digital Purchases Are Ready</h1>
              <p style="color:#bfdbfe;font-size:13px;margin:4px 0 0 0;">Order #${escapeHtml(data.orderNumber)}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="font-size:14px;color:#495057;margin:0 0 16px 0;">Thank you for your purchase! Your digital delivery details are below. You can also access them anytime from your account's order page.</p>

              <!-- Digital Items -->
              ${itemsHtml}

              <!-- Footer -->
              <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e9ecef;">
                <p style="font-size:12px;color:#6c757d;margin:0;">If you have any issues accessing your purchase, please contact support.</p>
                <p style="font-size:12px;color:#adb5bd;margin:8px 0 0 0;">© 2026 ${escapeHtml(data.storeName)}</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your Digital Purchases Are Ready — Order #${data.orderNumber}

Thank you for your purchase from ${data.storeName}!

Your digital delivery details:

${digitalItems.map(item => {
  const d = item.fulfillmentData || {};
  let delivery = '';
  if (d.qrCodeContent) delivery += `QR Code: Available on your order page\n  Plan: ${d.planId || 'N/A'}\n`;
  if (d.cardUid) delivery += `Redemption Code: ${d.cardUid}\n`;
  if (d.downloadUrl) delivery += `Download: ${d.downloadUrl}\n`;
  if (d.productCode) delivery += `Product Code: ${d.productCode}\n`;
  return `- ${item.productName} (Qty: ${item.quantity})\n  Status: ${item.fulfillmentStatus || 'N/A'}\n${delivery}`;
}).join('\n')}

You can access your purchases anytime from your account's order page.

© 2026 ${data.storeName}`;

  return { html, text, subject };
}
