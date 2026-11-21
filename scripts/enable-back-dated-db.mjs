import { MongoClient } from 'mongodb';

const uri = "mongodb://Harsh:Harsh%402925@ac-dxh54g9-shard-00-00.hddqr9e.mongodb.net:27017,ac-dxh54g9-shard-00-01.hddqr9e.mongodb.net:27017,ac-dxh54g9-shard-00-02.hddqr9e.mongodb.net:27017/hotel?tls=true&authSource=admin&replicaSet=atlas-131fot-shard-0&retryWrites=true&w=majority&appName=Cluster0&readPreference=primary";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB Atlas');
  const db = client.db('hotel');

  // 1. Update collection 'hotels'
  const updateHotels = await db.collection('hotels').updateMany(
    {},
    { $set: { allowBackDatedCheckIn: true } }
  );
  console.log('Hotels collection updated allowBackDatedCheckIn:', updateHotels.modifiedCount);

  // 2. Update pms_app_state backup
  const backup = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' });
  if (backup && backup.data && Array.isArray(backup.data.hotels)) {
    for (const h of backup.data.hotels) {
      if (h) {
        h.allowBackDatedCheckIn = true;
      }
    }
    await db.collection('pms_app_state').updateOne(
      { _id: 'FULL_PMS_BACKUP' },
      { $set: { data: backup.data, updatedAt: new Date().toISOString() } }
    );
    console.log('pms_app_state hotels updated with allowBackDatedCheckIn: true');
  }

  await client.close();
  console.log('Done!');
}

main().catch(console.error);
