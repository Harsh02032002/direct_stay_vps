import { MongoClient } from 'mongodb';

const uri = "mongodb://Harsh:Harsh%402925@ac-dxh54g9-shard-00-00.hddqr9e.mongodb.net:27017,ac-dxh54g9-shard-00-01.hddqr9e.mongodb.net:27017,ac-dxh54g9-shard-00-02.hddqr9e.mongodb.net:27017/hotel?tls=true&authSource=admin&replicaSet=atlas-131fot-shard-0&retryWrites=true&w=majority&appName=Cluster0&readPreference=primary";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB Atlas');
  const db = client.db('hotel');

  // 1. Update collection 'rooms' if any
  const roomsUpdateResult = await db.collection('rooms').updateMany(
    { category: { $regex: /^delux$/i } },
    { $set: { category: 'Deluxe' } }
  );
  console.log('Rooms collection updated:', roomsUpdateResult.modifiedCount);

  // 2. Update collection 'bookings' if any
  const bookingsUpdateResult = await db.collection('bookings').updateMany(
    { roomType: { $regex: /^delux$/i } },
    { $set: { roomType: 'Deluxe' } }
  );
  console.log('Bookings collection updated:', bookingsUpdateResult.modifiedCount);

  // 3. Update pms_app_state (FULL_PMS_BACKUP)
  const backup = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' });
  if (backup && backup.data) {
    let modified = false;
    const data = backup.data;

    // Fix rooms in backup
    if (Array.isArray(data.rooms)) {
      for (const r of data.rooms) {
        if (r && r.category && r.category.trim().toLowerCase() === 'delux') {
          console.log(`Updating room ${r.number} (${r.hotelId}) category from ${r.category} to Deluxe`);
          r.category = 'Deluxe';
          modified = true;
        }
      }
    }

    // Fix bookings in backup
    if (Array.isArray(data.bookings)) {
      for (const b of data.bookings) {
        if (b && b.roomType && b.roomType.trim().toLowerCase() === 'delux') {
          b.roomType = 'Deluxe';
          modified = true;
        }
        if (b && b.roomCategory && b.roomCategory.trim().toLowerCase() === 'delux') {
          b.roomCategory = 'Deluxe';
          modified = true;
        }
      }
    }

    // Fix checkins in backup
    if (Array.isArray(data.checkins)) {
      for (const c of data.checkins) {
        if (c && c.roomType && c.roomType.trim().toLowerCase() === 'delux') {
          c.roomType = 'Deluxe';
          modified = true;
        }
        if (c && c.roomCategory && c.roomCategory.trim().toLowerCase() === 'delux') {
          c.roomCategory = 'Deluxe';
          modified = true;
        }
      }
    }

    if (modified) {
      await db.collection('pms_app_state').updateOne(
        { _id: 'FULL_PMS_BACKUP' },
        { $set: { data, updatedAt: new Date().toISOString() } }
      );
      console.log('pms_app_state backup successfully updated in MongoDB Atlas!');
    } else {
      console.log('No rooms in pms_app_state required updates.');
    }
  }

  await client.close();
  console.log('Done!');
}

main().catch(console.error);
