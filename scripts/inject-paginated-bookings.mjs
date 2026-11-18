import fs from 'fs';

const targetFiles = ['api/index.php', 'public/api/index.php', 'dist/api/index.php', 'live-upload/api/index.php'];

const bookingsRoutePhp = `
// 8.5 GET /api/bookings — Server-side Paginated Bookings API
if ($route === '/bookings' && $method === 'GET') {
    $caller = getCallerContext();
    if (!$caller['authenticated']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized session']);
        exit;
    }
    $targetHotelId = trim((string)($_GET['hotelId'] ?? ($_SERVER['HTTP_X_TARGET_HOTEL_ID'] ?? ($caller['hotelId'] ?? 'hotel-1'))));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 10)));
    $tab = strtolower(trim((string)($_GET['tab'] ?? 'all')));
    $search = strtolower(trim((string)($_GET['search'] ?? '')));
    $selectedDate = trim((string)($_GET['date'] ?? date('Y-m-d')));

    $state = loadServerPmsState($stateFile, $defaultMongoUri);
    $rawBookings = is_array($state['bookings'] ?? null) ? $state['bookings'] : [];
    $hotelBookings = array_values(array_filter($rawBookings, fn($b) => is_array($b) && (!isset($b['hotelId']) || $b['hotelId'] === $targetHotelId)));

    $todayCount = count($hotelBookings);
    $upcomingCount = count(array_filter($hotelBookings, fn($b) => empty($b['isCheckedIn']) && ($b['status'] ?? '') === 'Confirmed'));
    $inHouseCount = count(array_filter($hotelBookings, fn($b) => !empty($b['isCheckedIn']) && empty($b['isCheckedOut'])));
    $checkoutCount = count(array_filter($hotelBookings, fn($b) => !empty($b['isCheckedOut']) || ($b['checkOutDate'] ?? '') === $selectedDate));

    $filtered = $hotelBookings;
    if ($tab === 'upcoming') {
        $filtered = array_values(array_filter($filtered, fn($b) => empty($b['isCheckedIn']) && ($b['status'] ?? '') === 'Confirmed'));
    } elseif ($tab === 'checkin' || $tab === 'inhouse') {
        $filtered = array_values(array_filter($filtered, fn($b) => !empty($b['isCheckedIn']) && empty($b['isCheckedOut'])));
    } elseif ($tab === 'checkout' || $tab === 'departures') {
        $filtered = array_values(array_filter($filtered, fn($b) => !empty($b['isCheckedOut']) || ($b['checkOutDate'] ?? '') === $selectedDate));
    }

    if ($search !== '') {
        $filtered = array_values(array_filter($filtered, function($b) use ($search) {
            $name = strtolower((string)($b['customerName'] ?? ''));
            $bNo = strtolower((string)($b['bookingNo'] ?? ''));
            $mob = (string)($b['mobile'] ?? '');
            $rNo = (string)($b['roomNumber'] ?? '');
            $rNums = is_array($b['roomNumbers'] ?? null) ? array_map('strval', $b['roomNumbers']) : [];
            return (strpos($name, $search) !== false) || (strpos($bNo, $search) !== false) || (strpos($mob, $search) !== false) || (strpos($rNo, $search) !== false) || in_array($search, $rNums);
        }));
    }

    $total = count($filtered);
    $totalPages = max(1, (int)ceil($total / $limit));
    $skip = ($page - 1) * $limit;
    $items = array_slice($filtered, $skip, $limit);

    echo json_encode([
        'success' => true,
        'data' => $items,
        'bookings' => $items,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => $totalPages,
            'hasPrevPage' => $page > 1,
            'hasNextPage' => $page < $totalPages,
            'counts' => [
                'today' => $todayCount,
                'upcoming' => $upcomingCount,
                'checkin' => $inHouseCount,
                'checkout' => $checkoutCount,
                'all' => count($hotelBookings)
            ]
        ]
    ]);
    exit;
}
`;

for (const f of targetFiles) {
  if (!fs.existsSync(f)) continue;
  let code = fs.readFileSync(f, 'utf8');

  // Insert before // 9. UNIFIED PMS MODULE REST APIs
  if (!code.includes("if ($route === '/bookings' && $method === 'GET')")) {
    const marker = '// 9. UNIFIED PMS MODULE REST APIs';
    if (code.includes(marker)) {
      code = code.replace(marker, bookingsRoutePhp + '\n' + marker);
    }
  }

  // Update GET /pms/modules/:collection to support page & limit
  const oldGetBlock = `        echo json_encode([
            'success' => true,
            'collection' => $colKey,
            'hotelId' => $targetHotelId,
            'items' => $filtered
        ]);
        exit;`;

  const newGetBlock = `        $pageParam = isset($_GET['page']) ? (int)$_GET['page'] : null;
        $limitParam = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
        if ($pageParam !== null && $limitParam !== null) {
            $page = max(1, $pageParam);
            $limit = min(100, max(1, $limitParam));
            $total = count($filtered);
            $totalPages = max(1, (int)ceil($total / $limit));
            $skip = ($page - 1) * $limit;
            $paged = array_slice($filtered, $skip, $limit);
            echo json_encode([
                'success' => true,
                'collection' => $colKey,
                'hotelId' => $targetHotelId,
                'items' => $paged,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'totalPages' => $totalPages,
                    'hasPrevPage' => $page > 1,
                    'hasNextPage' => $page < $totalPages
                ]
            ]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'collection' => $colKey,
            'hotelId' => $targetHotelId,
            'items' => $filtered
        ]);
        exit;`;

  if (code.includes(oldGetBlock)) {
    code = code.replace(oldGetBlock, newGetBlock);
  }

  fs.writeFileSync(f, code, 'utf8');
  console.log('Updated ' + f);
}
