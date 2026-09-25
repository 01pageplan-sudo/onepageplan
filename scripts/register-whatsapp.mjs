#!/usr/bin/env node
/**
 * Register WhatsApp Phone Number with Meta Cloud API
 *
 * Usage:
 *   node scripts/register-whatsapp.mjs <6_DIGIT_PIN> [ACCESS_TOKEN]
 *
 * Example:
 *   node scripts/register-whatsapp.mjs 123456
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env if available
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[match[1]]) {
          process.env[match[1]] = val;
        }
      }
    }
  }
}

loadEnv();

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1234920483047663';
const pinArg = process.argv[2];
const tokenArg = process.argv[3];

const pin = (pinArg || process.env.WHATSAPP_PIN || '').trim();
const accessToken = (tokenArg || process.env.WHATSAPP_ACCESS_TOKEN || '').trim();

console.log('====================================================');
console.log(' Meta WhatsApp Cloud API - Phone Number Registration');
console.log('====================================================');
console.log(`Phone Number ID: ${PHONE_NUMBER_ID}`);
console.log(`PIN:             ${pin ? '****** (' + pin.length + ' digits)' : 'NOT PROVIDED'}`);
console.log(`Access Token:    ${accessToken ? accessToken.slice(0, 15) + '...' : 'NOT PROVIDED'}`);
console.log('----------------------------------------------------');

if (!pin || !/^\d{6}$/.test(pin)) {
  console.error('\n❌ ERROR: A valid 6-digit numeric PIN is required (e.g., 123456 or your chosen PIN).');
  console.log('\nUsage:');
  console.log('  node scripts/register-whatsapp.mjs <6_DIGIT_PIN> [ACCESS_TOKEN]');
  console.log('\nOr via curl in PowerShell:');
  console.log(`  curl.exe -X POST "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/register" \`
    -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \`
    -H "Content-Type: application/json" \`
    -d "{\\"messaging_product\\": \\"whatsapp\\", \\"pin\\": \\"<YOUR_6_DIGIT_PIN>\\"}"`);
  process.exit(1);
}

if (!accessToken) {
  console.error('\n❌ ERROR: Meta Access Token not found.');
  console.log('\nPlease provide your Meta Access Token as the second argument, or set WHATSAPP_ACCESS_TOKEN in .env:');
  console.log(`  node scripts/register-whatsapp.mjs ${pin} "EAA..."`);
  console.log('\nHow to get the access token:');
  console.log('  1. Go to https://developers.facebook.com/apps/2608708969567874/whatsapp-business/wa-dev-console/');
  console.log('  2. Under "API Setup", copy the "Temporary access token" (or generate a System User permanent token).');
  process.exit(1);
}

async function registerNumber() {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/register`;
  console.log(`\nSending registration request to: ${url}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: pin,
      }),
    });

    const data = await res.json();
    console.log('\nMeta API Response:');
    console.log(JSON.stringify(data, null, 2));

    if (res.ok && data.success) {
      console.log('\n✅ SUCCESS! Phone number 1234920403047663 (+91 81696 60060) is now REGISTERED with Meta Cloud API!');
      console.log('Two-step verification PIN has been successfully set.');
    } else {
      console.error('\n❌ Registration failed. Check the error details above.');
    }
  } catch (err) {
    console.error('\n❌ Request error:', err.message);
  }
}

registerNumber();
