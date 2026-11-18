/* Runs scripts/bill_calculator_fixtures.json through src/utils/billCalculator.ts and prints JSON results.
   Usage: npx tsx scripts/test_bill_calculator.ts  (exit code 1 on any mismatch) */
import fs from 'fs';
import path from 'path';
import { calculateBill, normalizeBillSettings } from '../src/utils/billCalculator';

const fixtures = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'scripts/bill_calculator_fixtures.json'), 'utf8'));
let failed = 0;
const out: Record<string, unknown>[] = [];
for (const fx of fixtures) {
  const settings = normalizeBillSettings(fx.input.settings);
  const r = calculateBill({ ...fx.input, settings });
  const actual: Record<string, unknown> = {
    subtotal: r.subtotal, discount: r.discount, taxableAmount: r.taxableAmount, totalTax: r.totalTax,
    cgst: r.cgst, sgst: r.sgst, grandTotal: r.grandTotal, receipts: r.receipts, balance: r.balance,
    refundDue: r.refundDue, paymentStatus: r.paymentStatus, taxRowCount: r.taxRows.length, amountInWords: r.amountInWords,
  };
  const errs = Object.entries(fx.expect).filter(([k, v]) => actual[k] !== v).map(([k, v]) => `${k}: expected ${v}, got ${actual[k]}`);
  if (errs.length) failed++;
  console.log(`${errs.length ? 'FAIL' : 'PASS'}  ${fx.name}${errs.length ? '\n      ' + errs.join('\n      ') : ''}`);
  out.push({ name: fx.name, ...actual });
}
fs.writeFileSync(path.resolve(process.cwd(), 'scripts/bill_calculator_ts_results.json'), JSON.stringify(out, null, 2));
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
