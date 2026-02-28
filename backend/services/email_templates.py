"""Email HTML templates for the platform.

All templates use inline CSS and table layout for maximum email client compatibility.
No external CSS, no images (better deliverability).
"""


def render_epoch_invitation(
    epoch_name: str,
    lore_text: str,
    invite_url: str,
) -> str:
    """Render the epoch invitation email as an HTML string.

    Military tactical dispatch aesthetic:
    - Dark background, monospace font
    - Amber accent color for CTA and epoch name
    - Dashed-border dossier box for lore text
    """
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Epoch Summons — {_esc(epoch_name)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Courier New',Courier,monospace;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid #333;">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:#666;text-transform:uppercase;">
                CLASSIFIED // EPOCH SUMMONS
              </p>
            </td>
          </tr>
          <!-- Epoch Name -->
          <tr>
            <td style="padding:32px 32px 16px;">
              <h1 style="margin:0;font-size:28px;font-weight:900;color:#f59e0b;letter-spacing:2px;text-transform:uppercase;font-family:'Courier New',Courier,monospace;">
                {_esc(epoch_name)}
              </h1>
            </td>
          </tr>
          <!-- Lore Dossier -->
          <tr>
            <td style="padding:0 32px 32px;">
              <div style="border:1px dashed #444;padding:20px;background-color:#111;">
                <p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;color:#666;text-transform:uppercase;">
                  INTEL DISPATCH
                </p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#ccc;">
                  {_esc(lore_text)}
                </p>
              </div>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 32px 40px;">
              <a href="{_esc(invite_url)}"
                 style="display:inline-block;padding:14px 32px;background-color:#f59e0b;color:#0a0a0a;font-family:'Courier New',Courier,monospace;font-size:13px;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border:2px solid #f59e0b;">
                ENTER THE COMMAND CENTER
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #222;">
              <p style="margin:0;font-size:10px;letter-spacing:2px;color:#444;text-transform:uppercase;">
                TRANSMISSION ORIGIN: metaverse.center
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _esc(text: str) -> str:
    """Escape HTML special characters."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
