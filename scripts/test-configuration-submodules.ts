import assert from 'node:assert';
import {
  DIRECTSTAY_PMS_SIDEBAR_TREE,
  flattenSidebarLeafNodes,
  isSidebarLeafActive,
  ActiveNavigationSnapshot
} from '../src/utils/sidebarNavigation';

console.log('Testing Configuration Sub-Modules & Dedicated Pages...');

const flatNodes = flattenSidebarLeafNodes(DIRECTSTAY_PMS_SIDEBAR_TREE);
const configNode = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.id === 'configuration');

assert(configNode, 'Configuration node must exist in DIRECTSTAY_PMS_SIDEBAR_TREE');
assert(configNode.children && configNode.children.length === 7, 'Configuration node must have exactly 7 sub-items');

const subItems = configNode.children.map((c) => ({
  id: c.id,
  label: c.label,
  target: c.target,
}));

console.log('Found Configuration sub-items:', subItems.map(s => `${s.label} (${s.id}) -> ${s.target?.activeTab}/${s.target?.profileSection || s.target?.staffSubTab}`));

// 1. Tax Setup
const taxNode = flatNodes.find((n) => n.id === 'cfg-tax-setup');
assert(taxNode, 'cfg-tax-setup must exist');
assert.strictEqual(taxNode.target?.activeTab, 'profile');
assert.strictEqual(taxNode.target?.profileSection, 'tax');

// 2. Payment Mode
const payNode = flatNodes.find((n) => n.id === 'cfg-payment-mode');
assert(payNode, 'cfg-payment-mode must exist');
assert.strictEqual(payNode.target?.activeTab, 'profile');
assert.strictEqual(payNode.target?.profileSection, 'payment_mode');

// 3. WhatsApp
const waNode = flatNodes.find((n) => n.id === 'cfg-whatsapp');
assert(waNode, 'cfg-whatsapp must exist');
assert.strictEqual(waNode.target?.activeTab, 'profile');
assert.strictEqual(waNode.target?.profileSection, 'whatsapp');

// 4. Department Setup (MUST BE UNTOUCHED)
const deptNode = flatNodes.find((n) => n.id === 'cfg-department-setup');
assert(deptNode, 'cfg-department-setup must exist');
assert.strictEqual(deptNode.target?.activeTab, 'staff', 'Department setup must be untouched and point to staff');
assert.strictEqual(deptNode.target?.staffSubTab, 'directory');

// 5. Shift Setup
const shiftNode = flatNodes.find((n) => n.id === 'cfg-shift-setup');
assert(shiftNode, 'cfg-shift-setup must exist');
assert.strictEqual(shiftNode.target?.activeTab, 'profile');
assert.strictEqual(shiftNode.target?.profileSection, 'shift');

// 6. Coupons
const coupNode = flatNodes.find((n) => n.id === 'cfg-coupons');
assert(coupNode, 'cfg-coupons must exist');
assert.strictEqual(coupNode.target?.activeTab, 'profile');
assert.strictEqual(coupNode.target?.profileSection, 'coupons');

// 7. Master Setup
const masterNode = flatNodes.find((n) => n.id === 'cfg-master-setup');
assert(masterNode, 'cfg-master-setup must exist');
assert.strictEqual(masterNode.target?.activeTab, 'profile');
assert.strictEqual(masterNode.target?.profileSection, 'master');

// Verify isSidebarLeafActive disambiguation
const taxState: ActiveNavigationSnapshot = {
  activeTab: 'profile',
  profileSection: 'tax',
};
assert(isSidebarLeafActive(taxNode, taxState), 'Tax node must be active when profileSection === tax');
assert(!isSidebarLeafActive(payNode, taxState), 'Payment node must NOT be active when profileSection === tax');
assert(!isSidebarLeafActive(waNode, taxState), 'WhatsApp node must NOT be active when profileSection === tax');

const payState: ActiveNavigationSnapshot = {
  activeTab: 'profile',
  profileSection: 'payment_mode',
};
assert(isSidebarLeafActive(payNode, payState), 'Payment node must be active when profileSection === payment_mode');
assert(!isSidebarLeafActive(taxNode, payState), 'Tax node must NOT be active when profileSection === payment_mode');

const waState: ActiveNavigationSnapshot = {
  activeTab: 'profile',
  profileSection: 'whatsapp',
};
assert(isSidebarLeafActive(waNode, waState), 'WhatsApp node must be active when profileSection === whatsapp');

const shiftState: ActiveNavigationSnapshot = {
  activeTab: 'profile',
  profileSection: 'shift',
};
assert(isSidebarLeafActive(shiftNode, shiftState), 'Shift node must be active when profileSection === shift');

const coupState: ActiveNavigationSnapshot = {
  activeTab: 'profile',
  profileSection: 'coupons',
};
assert(isSidebarLeafActive(coupNode, coupState), 'Coupons node must be active when profileSection === coupons');

const masterState: ActiveNavigationSnapshot = {
  activeTab: 'profile',
  profileSection: 'master',
};
assert(isSidebarLeafActive(masterNode, masterState), 'Master node must be active when profileSection === master');

console.log('✅ ALL Configuration sub-modules verification tests PASSED successfully!');
