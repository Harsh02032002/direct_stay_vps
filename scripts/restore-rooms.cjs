require('dotenv').config();
const fs = require('fs');
const { MongoClient } = require('mongodb');

const hotelId = 'hotel-1793886802242';

// The 19 rooms exactly from client photo (Screenshot 1)
const full19Rooms = [
  { number: '101', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '102', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '103', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'Twin Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '104', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'Twin Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '105', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '106', category: 'Standard', floor: '4th Floor', rate: 1500, bedType: 'Double Bed', maxOccupancy: 2, baseOccupancy: 2, extraPersonCharge: 400, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '107', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '108', category: 'Executive', floor: '4th Floor', rate: 2500, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 600, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '109', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'Twin Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '110', category: 'Executive', floor: '4th Floor', rate: 2500, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 600, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '111', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '112', category: 'Executive', floor: '4th Floor', rate: 2500, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 600, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '113', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'Twin Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '114', category: 'Deluxe', floor: '4th Floor', rate: 2000, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '115', category: 'Family Room', floor: '4th Floor', rate: 3000, bedType: 'Family Suite', maxOccupancy: 4, baseOccupancy: 3, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '116', category: 'Executive', floor: '4th Floor', rate: 2500, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 600, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '201', category: 'Premium Standard', floor: '5th Floor', rate: 2200, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '202', category: 'Premium Standard', floor: '5th Floor', rate: 2200, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] },
  { number: '203', category: 'Premium Standard', floor: '5th Floor', rate: 2200, bedType: 'King Size Bed', maxOccupancy: 3, baseOccupancy: 2, extraPersonCharge: 500, amenities: ['AC', 'Wi-Fi', 'TV'] }
];

const constructedRooms = full19Rooms.map(def => {
  const is101Occupied = def.number === '101';
  return {
    id: `${hotelId}-${def.number}`,
    hotelId,
    number: def.number,
    category: def.category,
    rate: def.rate,
    status: is101Occupied ? 'Occupied' : 'Available',
    cleaningStatus: 'Clean',
    floor: def.floor,
    bedType: def.bedType,
    maxOccupancy: def.maxOccupancy,
    baseOccupancy: def.baseOccupancy,
    extraPersonCharge: def.extraPersonCharge,
    amenities: def.amenities,
    images: [''],
    outOfOrderReason: ''
  };
});

async function main() {
  console.log('--- Starting Room Restoration for Hotel raj Recidency ---');

  // 1. Update local pms_state.json
  const statePath = 'api/storage/pms_state.json';
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const otherRooms = (state.rooms || []).filter(r => r && r.hotelId !== hotelId);
    state.rooms = [...otherRooms, ...constructedRooms];
    (state.hotels || []).forEach(h => {
      h.allowBackDatedCheckIn = true;
    });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    console.log('✅ Local pms_state.json updated with 19 rooms.');
  }

  // 2. Update local pms_state.seed.json
  const seedPath = 'api/storage/pms_state.seed.json';
  if (fs.existsSync(seedPath)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const otherSeedRooms = (seed.rooms || []).filter(r => r && r.hotelId !== hotelId);
      seed.rooms = [...otherSeedRooms, ...constructedRooms];
      (seed.hotels || []).forEach(h => {
        h.allowBackDatedCheckIn = true;
      });
      fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf8');
      console.log('✅ Local pms_state.seed.json updated with 19 rooms.');
    } catch (err) {
      console.warn('Seed update skipped:', err.message);
    }
  }

  // 3. Update MongoDB Atlas
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in env.');
    return;
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  console.log('✅ Connected to MongoDB Atlas');

  // Match the exact database used by server.ts ('hotel')
  const db = client.db('hotel');

  // 3A. Update FULL_PMS_BACKUP in pms_app_state
  const doc = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' });
  if (doc && doc.data) {
    // Filter out ANY previous rooms belonging to this hotel (including room 501)
    const mongoOtherRooms = (doc.data.rooms || []).filter(r => r && r.hotelId !== hotelId);
    doc.data.rooms = [...mongoOtherRooms, ...constructedRooms];

    // Ensure allowBackDatedCheckIn is true on all hotels
    (doc.data.hotels || []).forEach(h => {
      h.allowBackDatedCheckIn = true;
    });

    doc.updatedAt = new Date().toISOString();

    await db.collection('pms_app_state').replaceOne(
      { _id: 'FULL_PMS_BACKUP' },
      doc,
      { upsert: true }
    );
    console.log('✅ MongoDB pms_app_state (FULL_PMS_BACKUP) updated with 19 rooms for Hotel raj Recidency.');
  } else {
    console.warn('⚠️ FULL_PMS_BACKUP document not found in pms_app_state!');
  }

  // 3B. Update rooms domain collection
  await db.collection('rooms').deleteMany({ hotelId });
  const insRes = await db.collection('rooms').insertMany(constructedRooms);
  console.log(`✅ MongoDB collection 'rooms' updated with ${insRes.insertedCount} rooms.`);

  // Verify
  const verifyDoc = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' });
  const verifyRooms = (verifyDoc.data.rooms || []).filter(r => r && r.hotelId === hotelId);
  console.log(`\n🎉 Verification: FULL_PMS_BACKUP now contains ${verifyRooms.length} rooms for Hotel raj Recidency:`);
  console.log(verifyRooms.map(r => `${r.number} (${r.category}, ${r.floor})`).join(', '));

  await client.close();
  console.log('--- Room Restoration Complete ---');
}

main().catch(err => {
  console.error('Fatal error during restoration:', err);
  process.exit(1);
});
