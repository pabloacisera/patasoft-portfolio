export function showBlockedFullScreen(reason) {
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;
      justify-content:center;height:100vh;gap:20px;font-family:sans-serif;
      background:#0f172a;color:white;text-align:center;padding:24px;">
      <div style="font-size:48px;margin-bottom:4px;">🔒</div>
      <h2 style="color:#ef4444;font-size:24px;margin:0;">Cuenta bloqueada</h2>
      <p style="color:#94a3b8;max-width:420px;line-height:1.5;margin:0;">
        ${reason}
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
        <a href="/settings/subscription"
           style="background:#6366f1;color:white;padding:12px 28px;
           border-radius:8px;text-decoration:none;font-weight:600;">
          Renovar suscripción
        </a>
        <a href="/settings/export-data"
           style="background:transparent;color:#94a3b8;padding:12px 28px;
           border-radius:8px;text-decoration:none;font-weight:500;
           border:1.5px solid #334155;">
          Descargar mis datos
        </a>
      </div>
    </div>
  `;
}

export function showBlockedBanner(reason) {
  const existing = document.getElementById('blocked-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'blocked-banner';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:99999;
    background:#991b1b;color:white;padding:10px 20px;
    font-family:sans-serif;font-size:14px;text-align:center;
    display:flex;align-items:center;justify-content:center;gap:12px;
    flex-wrap:wrap;
  `;
  banner.innerHTML = `
    <span>🔒 ${reason}</span>
    <a href="/settings/subscription"
       style="background:white;color:#991b1b;padding:4px 16px;
       border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">
      Renovar suscripción
    </a>
    <a href="/settings/export-data"
       style="background:transparent;color:white;padding:4px 16px;
       border-radius:6px;text-decoration:none;font-weight:500;font-size:13px;
       border:1px solid rgba(255,255,255,0.4);">
      Descargar mis datos
    </a>
  `;
  document.body.prepend(banner);
}
