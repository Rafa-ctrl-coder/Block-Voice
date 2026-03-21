interface EmailTemplateParams {
  title: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  cta2Text?: string;
  cta2Url?: string;
}

export function buildEmailHtml({ title, bodyHtml, ctaText, ctaUrl, cta2Text, cta2Url }: EmailTemplateParams): string {
  const ctaButton = ctaText && ctaUrl ? `
    <tr>
      <td style="padding: 24px 0 8px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background-color: #1ec6a4; border-radius: 8px;">
              <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; font-family: system-ui, -apple-system, sans-serif;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  const cta2Button = cta2Text && cta2Url ? `
    <tr>
      <td style="padding: 8px 0 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background-color: transparent; border: 1px solid rgba(30,198,164,0.4); border-radius: 8px;">
              <a href="${cta2Url}" target="_blank" style="display: inline-block; padding: 10px 24px; color: #1ec6a4; font-size: 13px; font-weight: 600; text-decoration: none; font-family: system-ui, -apple-system, sans-serif;">
                ${cta2Text}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1f3d; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f1f3d;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px;">

          <!-- Header -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <span style="font-size: 20px; font-weight: 800; color: #1ec6a4; font-family: system-ui, -apple-system, sans-serif; letter-spacing: -0.5px;">BlockVoice</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #132847; border: 1px solid #1e3a5f; border-radius: 12px; padding: 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Title -->
                <tr>
                  <td style="padding: 0 0 16px 0;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; font-family: system-ui, -apple-system, sans-serif; line-height: 1.3;">
                      ${title}
                    </h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.65); font-family: system-ui, -apple-system, sans-serif;">
                    ${bodyHtml}
                  </td>
                </tr>

                <!-- CTA -->
                ${ctaButton}
                ${cta2Button}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0 0 0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: rgba(255,255,255,0.3); font-family: system-ui, -apple-system, sans-serif;">
                <a href="https://blockvoice.co.uk" style="color: rgba(255,255,255,0.3); text-decoration: none;">blockvoice.co.uk</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.2); font-family: system-ui, -apple-system, sans-serif;">
                <a href="https://blockvoice.co.uk/unsubscribe" style="color: rgba(255,255,255,0.2); text-decoration: underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="mailto:hello@blockvoice.co.uk" style="color: rgba(255,255,255,0.2); text-decoration: underline;">Help</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
