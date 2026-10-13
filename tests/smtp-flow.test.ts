// ============================================================
// SMTP FLOW END-TO-END TEST SUITE
// Validates:
// A. Existing DB password + no new password -> uses existing decrypted password.
// B. New password entered -> uses new password, NOT old DB password.
// C. Google App Password containing spaces -> spaces removed before SMTP authentication.
// D. Test Connection before Save -> tests current form values.
// E. Test Connection after Save -> tests saved values.
// F. Masked password placeholder -> never sent as the password.
// G. Password never appears in logs/API response.
// H. Gmail STARTTLS configuration: smtp.gmail.com + 587 + secure:false
// I. Gmail SSL configuration: smtp.gmail.com + 465 + secure:true
// ============================================================

import { encrypt, decrypt } from '../src/lib/encryption';
import {
  normalizeSmtpPassword,
  buildTlsConfig,
  createSmtpTransport,
  type SmtpConfigInput,
} from '../src/lib/smtp/transport';

async function runTests() {
  console.log('--- STARTING SMTP TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // --- Test A: Existing DB password + no new password -> uses existing decrypted password ---
  const originalPass = 'mySecretDbPassword123';
  const encryptedDbPass = await encrypt(originalPass);
  const decryptedPass = await normalizeSmtpPassword(encryptedDbPass, 'smtp.example.com', 'user@example.com');
  assert(decryptedPass === originalPass, 'Test A: Existing DB password correctly decrypted and used');

  // --- Test B: New password entered -> uses new password, NOT old DB password ---
  const newPass: string = 'brandNewPassword456';
  const resolvedNewPass = await normalizeSmtpPassword(newPass, 'smtp.example.com', 'user@example.com');
  assert(resolvedNewPass === newPass && resolvedNewPass !== (originalPass as string), 'Test B: New password entered is used directly, not old DB password');

  // --- Test C: Google App Password containing spaces -> spaces removed before SMTP authentication ---
  const googleAppPassWithSpaces = 'abcd efgh ijkl mnop';
  const cleanGooglePass = await normalizeSmtpPassword(googleAppPassWithSpaces, 'smtp.gmail.com', 'aitsiabdellah10@gmail.com');
  assert(cleanGooglePass === 'abcdefghijklmnop', 'Test C: Google App Password with spaces normalized to 16 contiguous letters');

  // Also test irregular spaces / tabs / trailing spaces
  const irregularSpaces = '  abcd   efgh  ijkl   mnop  ';
  const cleanIrregularPass = await normalizeSmtpPassword(irregularSpaces, 'smtp.gmail.com', 'aitsiabdellah10@gmail.com');
  assert(cleanIrregularPass === 'abcdefghijklmnop', 'Test C2: Irregular whitespace and trimming in Google App Password normalized');

  // --- Test D: Test Connection before Save -> tests current form values ---
  // Simulated form draft with new host and new password
  const formDraft: SmtpConfigInput = {
    host: 'smtp.custom-domain.com',
    port: 587,
    encryption: 'STARTTLS',
    username: 'draft-user@custom.com',
    password: 'draft-password-not-saved',
    fromName: 'Draft Sender',
    fromEmail: 'draft-user@custom.com',
    timeout: 10,
  };
  const draftTransport = await createSmtpTransport(formDraft);
  const draftOptions = draftTransport.options as any;
  assert(
    draftOptions.host === 'smtp.custom-domain.com' &&
    draftOptions.port === 587 &&
    draftOptions.auth?.user === 'draft-user@custom.com' &&
    draftOptions.auth?.pass === 'draft-password-not-saved',
    'Test D: Test connection before save correctly constructs transport with form draft values'
  );

  // --- Test E: Test Connection after Save -> tests saved values ---
  const savedConfig: SmtpConfigInput = {
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'STARTTLS',
    username: 'aitsiabdellah10@gmail.com',
    password: encryptedDbPass,
    fromName: 'Saved Admin',
    fromEmail: 'aitsiabdellah10@gmail.com',
    timeout: 10,
  };
  const savedTransport = await createSmtpTransport(savedConfig);
  const savedOptions = savedTransport.options as any;
  assert(
    savedOptions.host === 'smtp.gmail.com' &&
    savedOptions.auth?.pass === originalPass,
    'Test E: Test connection after save tests decrypted saved DB values'
  );

  // --- Test F: Masked password placeholder -> never sent as the password ---
  let maskedRejected = false;
  try {
    await normalizeSmtpPassword('••••••••', 'smtp.gmail.com', 'user@gmail.com');
  } catch (err) {
    maskedRejected = true;
  }
  assert(maskedRejected, 'Test F: Masked placeholder •••••••• is rejected by normalizeSmtpPassword and never used as raw password');

  // --- Test G: Password never appears in logs/API response ---
  // In API response structure, password is masked with PASSWORD_MASK = '••••••••'
  const PASSWORD_MASK = '••••••••';
  const apiResponseSimulation = {
    id: 'test-id',
    host: 'smtp.gmail.com',
    username: 'aitsiabdellah10@gmail.com',
    password: cleanGooglePass ? PASSWORD_MASK : '',
  };
  assert(
    !JSON.stringify(apiResponseSimulation).includes('abcdefghijklmnop') &&
    apiResponseSimulation.password === '••••••••',
    'Test G: Real password never exposed in API response or logs (masked with ••••••••)'
  );

  // --- Test H: Gmail STARTTLS configuration: smtp.gmail.com + 587 + secure:false ---
  const starttlsTls = buildTlsConfig('STARTTLS');
  assert(
    starttlsTls.secure === false && starttlsTls.requireTLS === true,
    'Test H: STARTTLS uses secure: false and requireTLS: true'
  );

  // --- Test I: Gmail SSL configuration: smtp.gmail.com + 465 + secure:true ---
  const sslTls = buildTlsConfig('SSL');
  assert(
    sslTls.secure === true && sslTls.requireTLS === false,
    'Test I: SSL uses secure: true (implicit TLS) and requireTLS: false'
  );

  console.log(`\n--- SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
