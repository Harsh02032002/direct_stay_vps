import fs from 'fs';

function updatePhpFiles(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');

  // Update TENANT_SCOPED_KEYS
  const oldTenantKeys = "'ownerCapitalTransactions'\n];";
  const newTenantKeys = `'ownerCapitalTransactions',
    'otaChannels', 'otaRoomMappings', 'otaRateRules', 'otaInventoryAllocations',
    'otaSyncLogs', 'otaSettlements', 'roomBlocks'
];`;
  if (code.includes(oldTenantKeys)) {
    code = code.replace(oldTenantKeys, newTenantKeys);
  }

  // Update legacy collectionMap
  const oldLegacyMap = `'ownerPayments' => 'hotel.owner_payments'\n            ];`;
  const newLegacyMap = `'ownerPayments' => 'hotel.owner_payments',
                'otaChannels' => 'hotel.ota_channels',
                'otaRoomMappings' => 'hotel.ota_room_mappings',
                'otaRateRules' => 'hotel.ota_rate_rules',
                'otaInventoryAllocations' => 'hotel.ota_inventory_allocations',
                'otaSyncLogs' => 'hotel.ota_sync_logs',
                'otaSettlements' => 'hotel.ota_settlements',
                'roomBlocks' => 'hotel.room_blocks',
                'pettyCash' => 'hotel.petty_cash',
                'cashBankAccounts' => 'hotel.cash_bank_accounts',
                'vouchers' => 'hotel.vouchers',
                'vendors' => 'hotel.vendors',
                'inventoryPurchases' => 'hotel.inventory_purchases',
                'reimbursements' => 'hotel.reimbursements',
                'dailyClosings' => 'hotel.daily_closings'
            ];`;
  if (code.includes(oldLegacyMap)) {
    code = code.replace(oldLegacyMap, newLegacyMap);
  }

  // Update lite collectionMap
  const oldLiteMap = `'ownerPayments' => 'owner_payments'\n    ];`;
  const newLiteMap = `'ownerPayments' => 'owner_payments',
        'otaChannels' => 'ota_channels',
        'otaRoomMappings' => 'ota_room_mappings',
        'otaRateRules' => 'ota_rate_rules',
        'otaInventoryAllocations' => 'ota_inventory_allocations',
        'otaSyncLogs' => 'ota_sync_logs',
        'otaSettlements' => 'ota_settlements',
        'roomBlocks' => 'room_blocks',
        'pettyCash' => 'petty_cash',
        'cashBankAccounts' => 'cash_bank_accounts',
        'vouchers' => 'vouchers',
        'vendors' => 'vendors',
        'inventoryPurchases' => 'inventory_purchases',
        'reimbursements' => 'reimbursements',
        'dailyClosings' => 'daily_closings'
    ];`;
  if (code.includes(oldLiteMap)) {
    code = code.replace(oldLiteMap, newLiteMap);
  }

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`Updated ${filePath}`);
}

['api/index.php', 'public/api/index.php', 'dist/api/index.php', 'live-upload/api/index.php'].forEach(updatePhpFiles);
