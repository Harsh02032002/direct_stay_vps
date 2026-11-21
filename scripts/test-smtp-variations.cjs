const nodemailer = require('nodemailer');

const candidates = [
  'k/C5cCH3Y',
  'k\\C5cCH3Y',
  'k/C5cCH3y',
  'K/C5cCH3Y',
  'k/C5cCH3Y ',
  ' k/C5cCH3Y',
  'k/C5CCH3Y',
  'k/c5cCH3Y',
  'k/C5cch3Y',
  'k/C5cCH3'
];

async function tryAuth(pw) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: 'contact@directstay.online',
      pass: pw
    },
    authMethod: 'LOGIN'
  });
  try {
    await transporter.verify();
    console.log(`🎉 SUCCESS with password: "${pw}"`);
    return true;
  } catch (err) {
    // console.log(`Failed "${pw}": ${err.message}`);
    return false;
  }
}

async function run() {
  console.log('Testing candidates against smtp.hostinger.com:465...');
  for (const pw of candidates) {
    const ok = await tryAuth(pw);
    if (ok) return;
  }
  console.log('None of the immediate variants matched. Testing authMethod PLAIN...');
  const tPlain = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: 'contact@directstay.online',
      pass: 'k/C5cCH3Y'
    },
    authMethod: 'PLAIN'
  });
  try {
    await tPlain.verify();
    console.log('🎉 SUCCESS with PLAIN authMethod!');
  } catch (e) {
    console.log('PLAIN failed:', e.message);
  }
}

run();
