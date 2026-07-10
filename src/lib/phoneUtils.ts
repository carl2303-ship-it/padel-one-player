export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  let hadPrefix = false;
  if (cleaned.startsWith('+00')) { cleaned = cleaned.slice(3); hadPrefix = true; }
  else if (cleaned.startsWith('+')) { cleaned = cleaned.slice(1); hadPrefix = true; }
  else if (cleaned.startsWith('00')) { cleaned = cleaned.slice(2); hadPrefix = true; }

  if (hadPrefix) {
    cleaned = cleaned.replace(/^(351|352|353|354|355|356|357|358|359|370|371|372|373|374|375|376|377|378|380|381|382|383|385|386|387|389|420|421|423|212|213|216|244|245|258|297|298|299|852|853|855|856|880|886|960|961|962|963|964|965|966|967|968|971|972|973|974|975|976|977|992|993|994|995|996|997|998)(?=\d{7,})/, '');
    cleaned = cleaned.replace(/^(20|27|30|31|32|33|34|36|39|40|41|43|44|45|46|47|48|49|51|52|53|54|55|56|57|58|60|61|62|63|64|65|66|81|82|84|86|90|91|92|93|94|95|98)(?=\d{7,})/, '');
    cleaned = cleaned.replace(/^[17](?=\d{9,})/, '');
  } else {
    cleaned = cleaned.replace(/^351(?=[29]\d{8}$)/, '');
  }

  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}
