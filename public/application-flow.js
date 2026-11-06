(() => {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function download(text, filename) { const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  window.renderApplicationReceipt = (result, root, address = '') => {
    const link = new URL(result.trackingUrl, location.origin).href;
    root.innerHTML = `<p class="eyebrow">YOUR NEXT CHAPTER</p><h2 id="application-title">Application received.</h2><div class="application-success"><p>${safe(result.message)}</p><strong class="receipt-reference">${safe(result.reference)}</strong><p>${safe(address)}</p><p class="form-note">Save this receipt privately. Its link lets you check the submission without a paid email service. Receipt links expire after 90 days; claim a new application into your account for continued access.</p><label>Private status link<input id="private-receipt-link" readonly value="${safe(link)}"></label><div class="receipt-actions"><a class="button green" href="${safe(result.trackingUrl)}">Check application status →</a><button class="text-link" type="button" id="copy-receipt">Copy link</button><button class="text-link" type="button" id="download-receipt">Download receipt ↓</button><button class="text-link" type="button" id="print-receipt">Print receipt</button></div><p id="receipt-message" role="status"></p><p class="form-note">Already have an account? Claim your receipt in My applications using the same email you entered on the form.</p><a class="text-link" href="/dashboard#my-applications">Open My applications →</a></div>`;
    root.querySelector('#copy-receipt').onclick = async () => { try { await navigator.clipboard.writeText(link); root.querySelector('#receipt-message').textContent = 'Private link copied.'; } catch { const field = root.querySelector('#private-receipt-link'); field.focus(); field.select(); root.querySelector('#receipt-message').textContent = 'Select and copy the link above.'; } };
    root.querySelector('#download-receipt').onclick = () => download(`Come Together · Application receipt\nReference: ${result.reference}\nAddress: ${address}\nPrivate status link: ${link}\n\nKeep this link private. The receipt is not a reservation, approval, or lease.\n`, result.reference + '-receipt.txt');
    root.querySelector('#print-receipt').onclick = () => window.print();
  };
  window.mountRentalApplication = (root, property, { onCancel, onSuccess } = {}) => {
    const address = property?.address || '';
    root.innerHTML = `<p class="eyebrow">${property ? 'RENTAL APPLICATION FORM' : 'OPEN RENTAL APPLICATION'}</p><h2 id="application-title">${property ? 'Apply for ' + safe(property.name) : 'A home on your mind?'}</h2><p>${property ? safe(address) + ' · $' + Number(property.price).toLocaleString() + ' / month' : 'Enter the address you want to apply for, even when it is not listed here. Management will confirm the property and availability.'}</p><form id="vacancy-application-form">${rentalApplicationMarkup({ address, locked: !!property })}<p id="application-error" role="alert"></p><p id="application-progress" role="status"></p><div class="application-submit-row"><button type="submit" class="button green">Submit application →</button><button type="button" class="text-link" id="cancel-application">Cancel</button></div></form>`;
    const form = root.querySelector('form'); prepareRentalApplication(form);
    root.querySelector('#cancel-application').onclick = onCancel || (() => location.assign('/'));
    form.onsubmit = async event => {
      event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
      root.querySelector('#application-error').textContent = ''; root.querySelector('#application-progress').textContent = 'Preparing your application and documents…';
      try {
        const data = await rentalApplicationData(form), response = await fetch(property ? '/api/vacancies/' + property.id + '/applications' : '/api/open-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), result = await response.json();
        if (!response.ok) throw Error(result.error || 'Unable to submit. Please try again.');
        if (!form.isConnected) return;
        renderApplicationReceipt(result, root, data.requestedAddress); onSuccess?.(result);
      } catch (error) { if (form.isConnected) { root.querySelector('#application-error').textContent = error.message; root.querySelector('#application-progress').textContent = ''; button.disabled = false; } }
    };
  };
})();
