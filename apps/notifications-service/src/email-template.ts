const WEB_URL = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3050';

/**
 * Инлайновые стили — почтовые клиенты (особенно Outlook/Gmail) не
 * гарантируют поддержку <style>-блоков и внешних CSS, поэтому всё
 * оформление идёт через style="" прямо в тегах. Логотип — по публичному
 * URL веб-приложения (apps/web/public/logo-full.png), не base64: письмо
 * легче, и картинка переиспользуется, а не дублируется в каждом письме.
 */
export function renderEmailHtml(params: { title: string; message: string; actionUrl?: string; actionLabel?: string }): string {
  const { title, message, actionUrl, actionLabel } = params;

  const paragraphs = message
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const button = actionUrl
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td style="border-radius:999px;background-color:#CC785C;">
          <a href="${escapeAttr(actionUrl)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">
            ${escapeHtml(actionLabel ?? 'Перейти')}
          </a>
        </td>
      </tr>
    </table>`
    : '';

  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:32px 16px;background-color:#F7F4EE;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr>
        <td style="background-color:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #EDE6D6;">
          <div style="height:6px;background-color:#CC785C;"></div>
          <div style="padding:32px 36px 36px;">
            <img src="${WEB_URL}/logo-full.png" alt="TaskHunt" height="34" style="display:block;margin-bottom:28px;" />
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1c1917;font-weight:normal;">${escapeHtml(title)}</h1>
            <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
              ${paragraphs}
              ${button}
            </div>
          </div>
          <div style="padding:20px 36px;background-color:#FDFCFA;border-top:1px solid #EDE6D6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:12px;color:#a8a29e;">TaskHunt — фриланс-биржа со встроенным крипто-эскроу.</p>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
