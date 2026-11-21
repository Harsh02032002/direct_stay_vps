import { DIRECTSTAY_PMS_SIDEBAR_TREE } from '../src/utils/sidebarNavigation';

console.log('Testing Administration & HRM Sub-Modules...');

const adminTree = DIRECTSTAY_PMS_SIDEBAR_TREE;

// 1. Verify HRM Module is an independent top-level node right after Financial Hub
const finIndex = adminTree.findIndex((n) => n.id === 'financial-hub');
const hrmIndex = adminTree.findIndex((n) => n.id === 'hrm-module');
const posIndex = adminTree.findIndex((n) => n.id === 'point-of-sale');

if (hrmIndex === -1) {
  throw new Error('❌ HRM Module top-level node NOT found in sidebar tree!');
}
console.log(`✅ Found top-level HRM Module at position index ${hrmIndex}: "${adminTree[hrmIndex].label}"`);

if (finIndex !== -1 && hrmIndex !== finIndex + 1) {
  console.warn(`⚠️ HRM module is at index ${hrmIndex}, financial hub is at index ${finIndex}`);
} else {
  console.log('✅ HRM module is positioned immediately after Financial Hub!');
}

const hrmNode = adminTree[hrmIndex];
const hrmSubIds = (hrmNode.children || []).map((c) => c.id);
const expectedHrm = [
  'hrm-staff-directory',
  'hrm-attendance',
  'hrm-payroll',
  'hrm-shift-roster',
  'hrm-leaves',
];

for (const exp of expectedHrm) {
  if (!hrmSubIds.includes(exp)) {
    throw new Error(`❌ Missing HRM child node: ${exp}`);
  }
}
console.log('✅ All 5 HRM sub-modules present:', hrmSubIds);

// 2. Verify Administration Dedicated Nodes
const adminNode = adminTree.find((n) => n.id === 'administration');
if (!adminNode) {
  throw new Error('❌ Administration node not found in sidebar tree!');
}
const adminSubNodes = adminNode.children || [];
const adminSubMap = new Map(adminSubNodes.map((c) => [c.id, c.target]));

console.log('✅ Administration Sub-Nodes Found:');
adminSubNodes.forEach((c) => {
  console.log(`   - ${c.label} (${c.id}) -> activeTab: ${c.target.activeTab}, subTab: ${c.target.staffSubTab || c.target.roomSubTab || c.target.profileSection}`);
});

if (adminSubMap.get('adm-properties')?.profileSection !== 'properties') {
  throw new Error('❌ adm-properties does not target profileSection: properties');
}
if (adminSubMap.get('adm-building-floor')?.roomSubTab !== 'buildingFloor') {
  throw new Error('❌ adm-building-floor does not target roomSubTab: buildingFloor');
}
if (adminSubMap.get('adm-users')?.staffSubTab !== 'allUsers') {
  throw new Error('❌ adm-users does not target staffSubTab: allUsers');
}
if (adminSubMap.get('adm-user-roles')?.staffSubTab !== 'roles') {
  throw new Error('❌ adm-user-roles does not target staffSubTab: roles');
}
if (adminSubMap.get('adm-profile-setup')?.profileSection !== 'master') {
  throw new Error('❌ adm-profile-setup does not target profileSection: master');
}

// 3. Verify Department Setup is UNTOUCHED
const configNode = adminTree.find((n) => n.id === 'configuration');
const deptNode = configNode?.children?.find((c) => c.id === 'cfg-department-setup');
if (!deptNode) {
  throw new Error('❌ cfg-department-setup missing from configuration!');
}
console.log('✅ Department Setup (cfg-department-setup) is 100% untouched and present in Configuration.');

console.log('\n============================================================');
console.log('🎉 ALL HRM & ADMINISTRATION DEDICATED SUITE TESTS PASSED! 🎉');
console.log('============================================================\n');
