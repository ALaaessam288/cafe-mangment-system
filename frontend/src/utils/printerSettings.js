/* ═══════════════════════════════════════════════════════════════
   Per-terminal printer mapping.

   Which physical printer the kitchen ticket, the bar ticket and the customer
   receipt go to is a property of THIS machine, not of the tenant - the same
   café can have a POS at the counter and another on the floor, each cabled to
   different printers. So the mapping lives in localStorage on the terminal and
   never touches the backend.
   ═══════════════════════════════════════════════════════════════ */

const KEY = 'wanas_pos_printers';

export const PRINT_TARGETS = [
  { id: 'KITCHEN', label: 'بون المطبخ (المطعم)', hint: 'الأصناف اللي بتتعمل في المطبخ' },
  { id: 'BAR',     label: 'بون البار (البوفيه)', hint: 'المشروبات وأصناف البار' },
  { id: 'RECEIPT', label: 'فاتورة العميل',       hint: 'الإيصال اللي بيتسلم للعميل' },
];

const EMPTY = { KITCHEN: '', BAR: '', RECEIPT: '', silent: true };

export function getPrinterSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function savePrinterSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...EMPTY, ...settings }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the print options for one target.
 * When silent mode is enabled, jobs go silently to the assigned printer
 * or to the Windows default printer if no specific printer is mapped.
 */
export function printOptionsFor(target, base = {}) {
  const settings = getPrinterSettings();
  const deviceName = settings[target] || '';
  const isSilent = settings.silent !== false;
  return {
    ...base,
    deviceName: deviceName || undefined,
    silent: isSilent,
  };
}

/** Windows printers visible to this terminal (Electron only). */
export async function listSystemPrinters() {
  if (!window.api?.listPrinters) return [];
  try {
    return (await window.api.listPrinters()) ?? [];
  } catch {
    return [];
  }
}

export const isElectron = () => !!window.api?.isElectron;
