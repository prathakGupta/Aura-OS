import nodemailer from 'nodemailer';

let _transporter = null;

const createSmtpConfig = () => {
  // SendGrid SMTP path (recommended when SENDGRID_API_KEY exists).
  if (process.env.SENDGRID_API_KEY) {
    return {
      host: process.env.SENDGRID_SMTP_HOST || 'smtp.sendgrid.net',
      port: Number(process.env.SENDGRID_SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SENDGRID_SMTP_USER || 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };
  }

  return null;
};

const getTransporter = () => {
  if (_transporter) return _transporter;
  const config = createSmtpConfig();
  if (!config) return null;
  _transporter = nodemailer.createTransport(config);
  return _transporter;
};

const toAttachment = (pdfBuffer, reportId) => {
  if (!pdfBuffer) return [];
  return [
    {
      filename: `AuraOS-Clinical-Report-${reportId || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ];
};

/**
 * Sends report email to guardian. Returns status object and never throws.
 */
export const sendGuardianReportEmail = async ({
  to,
  guardianName,
  userId,
  riskLevel,
  reportId,
  summary,
  downloadUrl,
  pdfBuffer,
}) => {
  const recipient = String(to || '').trim();
  if (!recipient) {
    return { success: false, skipped: true, channel: 'email', error: 'Missing guardian email.' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log('[Email MOCK] Would send clinical report to:', recipient);
    return { success: true, mock: true, channel: 'email' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'AuraOS <no-reply@auraos.local>';
  const safeSummary = String(summary || '').slice(0, 1200);
  const safeName = guardianName || 'Guardian';

  const subject = `AuraOS Clinical Advisory (${String(riskLevel || 'watch').toUpperCase()})`;

  const text = [
    `Hello ${safeName},`,
    '',
    `AuraOS detected an elevated stress event for user ${userId}.`,
    `Risk Level: ${riskLevel || 'watch'}`,
    '',
    'Summary:',
    safeSummary || 'No summary available.',
    '',
    `Report ID: ${reportId}`,
    downloadUrl ? `Download PDF: ${downloadUrl}` : null,
    '',
    'This report is supportive and informational, not a diagnosis.',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial, sans-serif; line-height:1.6; color:#0f172a;">
      <h2 style="margin:0 0 8px;">AuraOS Clinical Advisory</h2>
      <p style="margin:0 0 12px;"><strong>Risk Level:</strong> ${String(riskLevel || 'watch').toUpperCase()}</p>
      <p style="margin:0 0 12px;">Hello ${safeName}, AuraOS detected an elevated stress event for user <strong>${userId}</strong>.</p>
      <p style="margin:0 0 12px;"><strong>Summary:</strong><br/>${safeSummary || 'No summary available.'}</p>
      <p style="margin:0 0 12px;"><strong>Report ID:</strong> ${reportId}</p>
      ${downloadUrl ? `<p style="margin:0 0 12px;"><a href="${downloadUrl}">Download PDF Report</a></p>` : ''}
      <p style="font-size:12px; color:#6b7280;">This report is supportive and informational, not a diagnosis.</p>
    </div>
  `;

  try {
    const result = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      text,
      html,
      attachments: toAttachment(pdfBuffer, reportId),
    });

    return {
      success: true,
      channel: 'email',
      messageId: result?.messageId || null,
      mock: false,
    };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return { success: false, channel: 'email', error: err.message, mock: false };
  }
};

