const nodemailer = require('nodemailer');

async function testAuth(username, password) {
  console.log(`Testing user: "${username}", pass length: ${password.length}...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: username,
      pass: password
    }
  });

  try {
    await transporter.verify();
    console.log(`✅ SUCCESS with user "${username}"!`);
    return true;
  } catch (err) {
    console.log(`❌ FAILED with user "${username}":`, err.message);
    return false;
  }
}

async function run() {
  await testAuth('contact@directstay.online', 'k/C5cCH3Y');
  await testAuth('contact@directstay.online', 'k/C5cCH3Y'.trim());
  await testAuth('contact', 'k/C5cCH3Y');
}

run();
