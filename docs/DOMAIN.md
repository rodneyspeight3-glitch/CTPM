# Production domain and HTTPS

The primary address is **https://ctpm.online**. Both custom domains are attached to the existing `ctpm` Render service; `www.ctpm.online` redirects to the primary address. The existing `ctpm.onrender.com` address remains available so older private application and lease links continue to work.

`PUBLIC_APP_URL=https://ctpm.online` controls newly generated absolute links. Leave `APP_ORIGIN` unset to retain the application's same-origin protections on both the custom domain and the existing Render hostname. Do not replace the persistent disk or database to troubleshoot a certificate problem.

## Verified state on November 23, 2026

| Check | Observed result |
|---|---|
| Root DNS | `ctpm.online A 216.24.57.1`; no AAAA record |
| WWW DNS | `www.ctpm.online CNAME ctpm.onrender.com` |
| Render domain validation | Both domains verified |
| HTTP root | 301 redirect to `https://ctpm.online/` |
| HTTP WWW | 301 to HTTPS, then the primary domain |
| HTTPS root | 200; HSTS `max-age=31536000` |
| Fresh Chromium navigation | Secure on all four HTTP/HTTPS root/WWW entry variants |
| Mixed resources | No HTTP subresources observed on the home page |
| Independent SSL Labs assessment | Root endpoint `216.24.57.1`: A+, no endpoint warnings |
| Independent WWW assessment | Both resolved WWW endpoints: A, no endpoint warnings or leaf-certificate issues |

The independent assessment reported a valid `ctpm.online` certificate issued by Google Trust Services, with no leaf-certificate issues. These are dated observations, not a guarantee that a later browser warning can be ignored. An SSL warning reported on the owner's device has not yet been reproduced; its exact wording/code was unavailable.

## When a browser reports an SSL warning

1. Open the complete address `https://ctpm.online` in a fresh private window. Check whether the address contains `www`, an accidental extra character, or another hostname.
2. Verify the device date and time are correct. A wrong clock can make valid certificates appear expired or not yet valid.
3. Try another browser or connection. A recent DNS change can leave an old address in a browser, router or resolver cache. A private window does not necessarily clear operating-system or network DNS caches.
4. If the warning remains, record its exact text, any `ERR_…` code, hostname, browser and device. View certificate details if available; do not bypass certificate validation. This distinguishes a stale destination, hostname mismatch, certificate expiry and a local trust/proxy issue.
5. Recheck Render's **Settings → Custom domains**, authoritative DNS and an independent [SSL Labs report](https://www.ssllabs.com/ssltest/analyze.html?d=ctpm.online). A cached report may need a new assessment after a real configuration change.

Render manages the HTTPS certificate. Do not buy a separate certificate, disable HTTPS, weaken TLS verification or add an insecure browser exception as a fix. Change DNS or domain attachment only when the checks show the incorrect record or missing domain. Keep the existing mail records while changing website records.

## Email is separate from website HTTPS

`ctpm.online` has Spacemail MX records and one observed Spacemail SPF record. An existing active mailbox such as the owner-selected `screening@ctpm.online` can use Spacemail's authenticated SMTP service. Its SMTP hostname is `mail.spacemail.com`, not the Render website. See [the SMTP guide](SMTP.md#existing-spacemail-mailbox-on-ctpmonline) for the administrator setup and connection check. The mailbox password must be saved privately; it is never part of this document.
