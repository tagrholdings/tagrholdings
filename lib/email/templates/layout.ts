const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const LOGO_URL = `${SITE_URL}/brand/LogoBrand-Monocolor.png`;

export function emailLayout(bodyHtml: string) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0; padding:0; background-color:#ede8df;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ede8df; padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#f5f2ec; border-radius:4px; overflow:hidden;">
                <tr>
                  <td style="background-color:#1b1d1f; padding:28px 32px;">
                    <img src="${LOGO_URL}" alt="TAGR Holdings" height="28" style="display:block; height:28px; width:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 32px; font-family:Arial, Helvetica, sans-serif; color:#1b1d1f; line-height:1.6; font-size:15px;">
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px; border-top:1px solid rgba(27,29,31,0.12); font-family:Arial, Helvetica, sans-serif; font-size:12px; color:rgba(27,29,31,0.55);">
                    TAGR Holdings &middot; <a href="${SITE_URL}" style="color:#9c7a3c; text-decoration:none;">tagrholdings.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
