/**
 * DirectStay Luxury Cloud PMS — Enterprise Email Notification Engine
 * Hostinger SMTP Transport & Automated HTML Email Templates
 */

export interface EmailDispatchOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  eventType?: string;
  hotelId?: string;
}

// 1. New Hotel Onboarding Email (To SuperAdmin & Hotel Owner)
export function getHotelOnboardingEmail(hotel: {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  city?: string;
  roomsCount?: number;
}): { subject: string; text: string; html: string } {
  const subject = `🏨 Welcome to DirectStay PMS — Onboarding Application Received (${hotel.name})`;
  const text = `Dear ${hotel.ownerName},\n\nThank you for onboarding ${hotel.name} with DirectStay Luxury Cloud PMS.\nYour property profile is currently being initialized by our onboarding desk.\nWe will notify you as soon as your hotel management dashboard is approved and active.\n\nSupport: contact@directstay.online | WhatsApp: +91 7978563771`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ded5; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1C140E 0%, #2B1B11 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 24px; font-family: Georgia, serif;">DirectStay. PMS</h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: #d0c2b2; text-transform: uppercase; letter-spacing: 1px;">Luxury Hospitality Cloud Infrastructure</p>
      </div>
      <div style="padding: 28px; color: #2B1B11; line-height: 1.6;">
        <h2 style="margin-top: 0; font-size: 18px; color: #1C140E;">Namaste ${hotel.ownerName},</h2>
        <p>Thank you for submitting your onboarding details for <strong>${hotel.name}</strong> on DirectStay PMS.</p>
        
        <div style="background: #FAF7F2; border: 1px solid #E6DED5; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 14px; color: #8C6D23; text-transform: uppercase; letter-spacing: 0.5px;">Onboarding Property Summary</h3>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #735A38;">Hotel Name:</td><td style="font-weight: bold; text-align: right;">${hotel.name}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Owner / GM:</td><td style="font-weight: bold; text-align: right;">${hotel.ownerName}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Registered Phone:</td><td style="font-weight: bold; text-align: right;">${hotel.phone}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Registered Email:</td><td style="font-weight: bold; text-align: right;">${hotel.email}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Location:</td><td style="font-weight: bold; text-align: right;">${hotel.city || 'India'}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Status:</td><td style="font-weight: bold; color: #D97706; text-align: right;">Pending Activation</td></tr>
          </table>
        </div>

        <p style="font-size: 13px;">Our SuperAdmin verification desk is validating your license and configuring your room categories. You will receive an activation email with your dashboard credentials shortly.</p>
        
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E6DED5; font-size: 12px; color: #8C7B6B;">
          DirectStay Cloud Helpdesk: <a href="mailto:contact@directstay.online" style="color: #8C6D23;">contact@directstay.online</a> | WhatsApp: <strong>+91 7978563771</strong>
        </div>
      </div>
    </div>
  `;
  return { subject, text, html };
}

// 2. Hotel Profile Approved / Activated Email (With Credentials)
export function getHotelProfileActivatedEmail(hotel: {
  name: string;
  ownerName: string;
  loginUrl: string;
  username: string;
  temporaryPasscode: string;
  planName?: string;
}): { subject: string; text: string; html: string } {
  const subject = `🎉 Your DirectStay PMS Portal is Active! — Login Credentials for ${hotel.name}`;
  const text = `Dear ${hotel.ownerName},\n\nYour hotel property profile for "${hotel.name}" has been approved and activated!\n\nPortal URL: ${hotel.loginUrl}\nUsername: ${hotel.username}\nPassword: ${hotel.temporaryPasscode}\nPlan: ${hotel.planName || 'Enterprise SaaS Plan'}\n\nPlease sign in and rotate your security passcode.\n\nSupport: contact@directstay.online | WhatsApp: +91 7978563771`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ded5; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1C140E 0%, #2B1B11 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 24px; font-family: Georgia, serif;">DirectStay. PMS</h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: #d0c2b2; text-transform: uppercase; letter-spacing: 1px;">Account Activation Notice</p>
      </div>
      <div style="padding: 28px; color: #2B1B11; line-height: 1.6;">
        <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; color: #065F46; font-size: 13px; font-weight: bold;">
          ✓ Hotel Property Approved &amp; Subscription Active
        </div>

        <h2 style="margin-top: 0; font-size: 18px; color: #1C140E;">Congratulations ${hotel.ownerName}!</h2>
        <p>We are delighted to confirm that <strong>${hotel.name}</strong> is now live on DirectStay PMS Cloud. Your staff and guest management desks are fully initialized.</p>

        <div style="background: #FAF7F2; border: 1px solid #E6DED5; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 13px; color: #8C6D23; text-transform: uppercase; letter-spacing: 0.5px;">Your Admin Sign-In Credentials</h3>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Login Portal:</strong> <a href="${hotel.loginUrl}" style="color: #8C6D23; word-break: break-all;">${hotel.loginUrl}</a></p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Admin Username:</strong> <code style="background: #EDE8DE; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${hotel.username}</code></p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Security Passcode:</strong> <code style="background: #EDE8DE; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #B45309;">${hotel.temporaryPasscode}</code></p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Active Plan:</strong> <span style="font-weight: bold; color: #047857;">${hotel.planName || 'Enterprise SaaS Plan'}</span></p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${hotel.loginUrl}" style="background: #1C140E; color: #D4AF37; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Launch Hotel PMS Dashboard →
          </a>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E6DED5; font-size: 12px; color: #8C7B6B;">
          For priority setup assistance, contact DirectStay Concierge at <a href="mailto:contact@directstay.online" style="color: #8C6D23;">contact@directstay.online</a> or WhatsApp <strong>+91 7978563771</strong>.
        </div>
      </div>
    </div>
  `;
  return { subject, text, html };
}

// 3. Free Trial Expiry Warning Email
export function getTrialExpiryWarningEmail(hotel: {
  name: string;
  ownerName: string;
  daysRemaining: number;
  renewalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `⚠️ Important: Free Trial for ${hotel.name} is Expiring in ${hotel.daysRemaining} Day(s)`;
  const text = `Dear ${hotel.ownerName},\n\nYour free trial for "${hotel.name}" on DirectStay PMS will expire in ${hotel.daysRemaining} day(s).\nTo maintain uninterrupted reservation sync, OTA connectivity, and guest invoicing, please renew your membership plan.\n\nRenew Now: ${hotel.renewalUrl}\nWhatsApp Support: +91 7978563771`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ded5; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1C140E 0%, #2B1B11 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 24px; font-family: Georgia, serif;">DirectStay. PMS</h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: #d0c2b2; text-transform: uppercase; letter-spacing: 1px;">Subscription Renewal Notice</p>
      </div>
      <div style="padding: 28px; color: #2B1B11; line-height: 1.6;">
        <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; color: #92400E; font-size: 13px; font-weight: bold;">
          ⚠️ Free Trial Expiring in ${hotel.daysRemaining} Day(s)
        </div>

        <h2 style="margin-top: 0; font-size: 18px; color: #1C140E;">Hello ${hotel.ownerName},</h2>
        <p>Your free trial period for <strong>${hotel.name}</strong> will conclude in <strong>${hotel.daysRemaining} day(s)</strong>. All your hotel guest folios, bookings, and financial logs are securely preserved in your tenant database.</p>

        <p>To ensure zero downtime for your front desk, room allocations, and channel manager sync, please select your subscription package:</p>

        <div style="background: #FAF7F2; border: 1px solid #E6DED5; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #524336;">
            <li><strong>Full PMS:</strong> ₹5,999/yr — Unlimited Rooms</li>
            <li><strong>PMS + Channel Starter:</strong> ₹12,999/yr — Full PMS + OTA sync for 10 rooms</li>
            <li><strong>Growth Suite:</strong> ₹14,999/yr — Full PMS + Growth OTA Manager</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${hotel.renewalUrl}" style="background: #D4AF37; color: #1C140E; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Renew Subscription Now →
          </a>
        </div>
      </div>
    </div>
  `;
  return { subject, text, html };
}

// 4. Subscription Expired Notice Email
export function getSubscriptionExpiredEmail(hotel: {
  name: string;
  ownerName: string;
  renewalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `🚨 DirectStay PMS Subscription Expired — Action Required for ${hotel.name}`;
  const text = `Dear ${hotel.ownerName},\n\nThe PMS subscription for "${hotel.name}" has expired.\nYour guest records and room registry are safely archived. Please renew via direct UPI or Card to re-enable front desk check-in features.\n\nRenew: ${hotel.renewalUrl}\nWhatsApp Support: +91 7978563771`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ded5; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1C140E 0%, #2B1B11 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 24px; font-family: Georgia, serif;">DirectStay. PMS</h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: #d0c2b2; text-transform: uppercase; letter-spacing: 1px;">Subscription Status: Expired</p>
      </div>
      <div style="padding: 28px; color: #2B1B11; line-height: 1.6;">
        <div style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; color: #991B1B; font-size: 13px; font-weight: bold;">
          🚨 Membership Expired — Renewal Required
        </div>
        <h2 style="margin-top: 0; font-size: 18px; color: #1C140E;">Notice for ${hotel.ownerName},</h2>
        <p>The SaaS subscription period for <strong>${hotel.name}</strong> has ended. All your historical records, invoices, and guest folios remain completely safe and protected.</p>
        <p>Click below to complete direct UPI payment and instantly reactivate your PMS portal:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${hotel.renewalUrl}" style="background: #1C140E; color: #D4AF37; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Instant UPI &amp; Gateway Renewal →
          </a>
        </div>
      </div>
    </div>
  `;
  return { subject, text, html };
}

// 5. Guest Tax Invoice Email
export function getGuestTaxInvoiceEmail(invoice: {
  hotelName: string;
  hotelGstin?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  guestName: string;
  invoiceNumber: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  tariffAmount: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  paymentMode: string;
}): { subject: string; text: string; html: string } {
  const subject = `🧾 Official Tax Invoice ${invoice.invoiceNumber} — ${invoice.hotelName}`;
  const text = `Dear ${invoice.guestName},\n\nThank you for staying at ${invoice.hotelName}.\nYour official Tax Invoice ${invoice.invoiceNumber} for Room ${invoice.roomNumber} has been generated.\nStay Dates: ${invoice.checkInDate} to ${invoice.checkOutDate}\nTotal Amount Paid: ₹${invoice.totalAmount.toLocaleString('en-IN')}\nPayment Tender: ${invoice.paymentMode}\n\nWe look forward to welcoming you again!`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ded5; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1C140E 0%, #2B1B11 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 22px; font-family: Georgia, serif;">${invoice.hotelName}</h1>
        <p style="margin: 4px 0 0; font-size: 11px; color: #d0c2b2; text-transform: uppercase; letter-spacing: 1px;">Official Guest Tax Invoice</p>
      </div>
      <div style="padding: 24px; color: #2B1B11; line-height: 1.5;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #E6DED5; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 11px; color: #735A38; text-transform: uppercase;">Invoice Number</div>
            <div style="font-size: 15px; font-weight: bold; font-family: monospace;">${invoice.invoiceNumber}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #735A38; text-transform: uppercase;">GSTIN</div>
            <div style="font-size: 12px; font-weight: bold; font-family: monospace;">${invoice.hotelGstin || '22AAAAA0000A1Z5'}</div>
          </div>
        </div>

        <p style="margin: 4px 0; font-size: 14px;">Dear <strong>${invoice.guestName}</strong>,</p>
        <p style="margin: 4px 0 16px; font-size: 12px; color: #524336;">Thank you for staying with us. Below is the itemized summary of your stay folio:</p>

        <div style="background: #FAF7F2; border: 1px solid #E6DED5; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #735A38;">Allocated Room:</td><td style="font-weight: bold; text-align: right;">Room ${invoice.roomNumber}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Stay Period:</td><td style="font-weight: bold; text-align: right;">${invoice.checkInDate} → ${invoice.checkOutDate}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">Base Room Tariff:</td><td style="font-weight: bold; text-align: right;">₹${invoice.tariffAmount.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">CGST:</td><td style="font-weight: bold; text-align: right;">₹${invoice.cgst.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 4px 0; color: #735A38;">SGST:</td><td style="font-weight: bold; text-align: right;">₹${invoice.sgst.toLocaleString('en-IN')}</td></tr>
            <tr style="border-top: 1px solid #E6DED5;"><td style="padding: 8px 0; font-weight: bold; font-size: 14px;">Total Settled:</td><td style="padding: 8px 0; font-weight: bold; font-size: 15px; color: #047857; text-align: right;">₹${invoice.totalAmount.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 2px 0; color: #735A38; font-size: 11px;">Payment Mode:</td><td style="font-size: 11px; font-weight: bold; text-align: right;">${invoice.paymentMode}</td></tr>
          </table>
        </div>

        <div style="text-align: center; font-size: 11px; color: #8C7B6B; border-top: 1px solid #E6DED5; padding-top: 12px;">
          ${invoice.hotelAddress || 'DirectStay Hotel Property'} • Phone: ${invoice.hotelPhone || '+91 7978563771'}
        </div>
      </div>
    </div>
  `;
  return { subject, text, html };
}
