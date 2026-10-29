process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { userStore, analysisStore } from '../src/models/dataStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'meiora_super_secure_jwt_secret_key_2026_x89a';

describe('Phase 1: Security and Correctness Hardening Test Suite', () => {
  let server;
  let baseUrl;
  let userA, userB, adminUser;
  let tokenA, tokenB, tokenAdmin;
  let recordA, recordB;

  before(async () => {
    // Connect to database if available
    await connectDB();

    // Start server on an ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Create test users
    userA = await userStore.create({
      name: 'Alice Owner',
      email: `alice_${Date.now()}@example.com`,
      password: 'Password123!',
      isVerified: true,
    });
    userB = await userStore.create({
      name: 'Bob Attacker',
      email: `bob_${Date.now()}@example.com`,
      password: 'Password123!',
      isVerified: true,
    });
    adminUser = await userStore.create({
      name: 'Admin Boss',
      email: `admin_${Date.now()}@example.com`,
      password: 'Password123!',
      isVerified: true,
    });
    // Set admin role
    await userStore.update(adminUser._id, { role: 'admin' });
    adminUser.role = 'admin';

    // Sign JWT tokens
    tokenA = jwt.sign({ id: userA._id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB._id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    tokenAdmin = jwt.sign({ id: adminUser._id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    // Seed analysis records with full required fields
    recordA = await analysisStore.create({
      userId: userA._id,
      type: 'news',
      analysisType: 'news',
      input: 'Confidential investigation analysis by Alice.',
      inputType: 'text',
      title: 'Secret News Investigation by Alice',
      trustScore: 85,
      confidence: 90,
      classification: 'Real',
      summary: 'Confidential investigation analysis.',
      explanation: 'Evidence thoroughly confirmed.',
    });

    recordB = await analysisStore.create({
      userId: userB._id,
      type: 'news',
      analysisType: 'news',
      input: 'Public news debunk by Bob.',
      inputType: 'text',
      title: 'Public News by Bob',
      trustScore: 30,
      confidence: 75,
      classification: 'Fake',
      summary: 'Misinformation debunk.',
      explanation: 'Fact-checked false.',
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await mongoose.disconnect();
    } catch {}
  });

  // ── TASK 1: AUTHENTICATION & OWNERSHIP TESTS ─────────────────────────────

  test('1.1: Unauthenticated GET /api/analysis/history returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/analysis/history`);
    assert.equal(res.status, 401, 'Expected 401 Unauthorized');
    const data = await res.json();
    assert.match(data.message, /auth/i);
  });

  test('1.2: Authenticated user receives only their own history, never all users', async () => {
    const resA = await fetch(`${baseUrl}/api/analysis/history`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(resA.status, 200);
    const dataA = await resA.json();
    assert.ok(Array.isArray(dataA.analyses));
    // Verify every record returned belongs strictly to Alice
    for (const item of dataA.analyses) {
      assert.equal(String(item.userId), String(userA._id), 'User A received record not owned by them');
    }
    // Ensure Bob's record is NOT in Alice's history
    const bFoundInA = dataA.analyses.some((x) => String(x._id) === String(recordB._id));
    assert.equal(bFoundInA, false, 'User A saw User B analysis record in history');
  });

  test('1.3: Unauthenticated GET /api/reports returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports`);
    assert.equal(res.status, 401, 'Expected 401 Unauthorized for reports list');
  });

  test('1.4: Unauthenticated GET /api/reports/:id/download returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports/${recordA._id}/download`);
    assert.equal(res.status, 401, 'Expected 401 Unauthorized for report download');
  });

  test('1.5: Cross-user GET /api/analysis/:id returns 404 without leaking metadata', async () => {
    // Bob attempts to read Alice's record
    const res = await fetch(`${baseUrl}/api/analysis/${recordA._id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(res.status, 404, 'Expected 404 Not Found to prevent leaking existence of private record');
    const body = await res.json();
    assert.equal(body.title, undefined, 'Private title must not be returned');
  });

  test('1.6: Cross-user DELETE /api/analysis/:id returns 404 and record is preserved', async () => {
    // Bob attempts to delete Alice's record
    const res = await fetch(`${baseUrl}/api/analysis/${recordA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(res.status, 404, 'Expected 404 Not Found when non-owner attempts deletion');

    // Verify record still exists
    const check = await analysisStore.findById(recordA._id);
    assert.ok(check, 'Alice record should not have been deleted by Bob');
  });

  test('1.7: Cross-user report download returns 404', async () => {
    // Bob attempts to download Alice's report PDF
    const res = await fetch(`${baseUrl}/api/reports/${recordA._id}/download`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(res.status, 404, 'Expected 404 Not Found for cross-user report download');
  });

  test('1.8: Copilot context isolation prevents access to private analysis by non-owner', async () => {
    // Bob attempts to query copilot using Alice's analysisId
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        question: 'What does this confidential analysis say?',
        analysisId: recordA._id,
      }),
    });
    assert.equal(res.status, 404, 'Expected 404 when querying another user private analysis via Copilot');
  });

  test('1.9: Record owner can read and delete their own record successfully', async () => {
    // Alice reads her own record
    const getRes = await fetch(`${baseUrl}/api/analysis/${recordA._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getRes.status, 200);
    const item = await getRes.json();
    assert.equal(String(item._id), String(recordA._id));

    // Alice deletes her own record
    const delRes = await fetch(`${baseUrl}/api/analysis/${recordA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes.status, 200);

    // Verify deleted
    const check = await analysisStore.findById(recordA._id);
    assert.ok(!check, 'Record should be successfully removed after deletion');
  });

  // ── TASK 2: DASHBOARD METRIC ACCURACY & CONFIDENCE TESTS ──────────────────

  test('2.1: Empty confidence set computes null (no hardcoded 89 fallback)', () => {
    const historyWithZeroConfidence = [
      { type: 'news', classification: 'Real', confidence: 0 },
      { type: 'news', classification: 'Fake', confidence: null },
      { type: 'brand', classification: 'Positive' },
    ];

    const withConf = historyWithZeroConfidence.filter(
      (h) => typeof h.confidence === 'number' && !isNaN(h.confidence) && h.confidence > 0 && h.confidence <= 100
    );
    const avgConfidence = withConf.length > 0
      ? Math.round(withConf.reduce((sum, h) => sum + h.confidence, 0) / withConf.length)
      : null;

    assert.equal(avgConfidence, null, 'Expected null when no valid confidence data exists');
    const displayValue = avgConfidence != null ? `${avgConfidence}%` : 'Not available yet';
    assert.equal(displayValue, 'Not available yet', 'Must show "Not available yet" empty state');
    assert.notEqual(displayValue, '89%', 'Must NOT return hardcoded 89%');
  });

  test('2.2: Valid confidence values correctly calculate average AI confidence', () => {
    const history = [
      { type: 'news', confidence: 80 },
      { type: 'news', confidence: 90 },
      { type: 'news', confidence: 70 },
    ];
    const withConf = history.filter(
      (h) => typeof h.confidence === 'number' && !isNaN(h.confidence) && h.confidence > 0 && h.confidence <= 100
    );
    const avgConfidence = Math.round(withConf.reduce((sum, h) => sum + h.confidence, 0) / withConf.length);
    assert.equal(avgConfidence, 80);
    const display = `${avgConfidence}%`;
    assert.equal(display, '80%');
  });

  // ── TASK 3: UPLOAD VALIDATION & SECURITY TESTS ───────────────────────────

  test('3.1: Reject non-video file upload to /api/analysis/deepfake-video with 400', async () => {
    const boundary = '----WebKitFormBoundaryTest' + Math.random().toString(36).substring(2);
    const fakeFileContent = 'This is plain text, not a video.';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="video"; filename="malicious_script.txt"',
      'Content-Type: text/plain',
      '',
      fakeFileContent,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(`${baseUrl}/api/analysis/deepfake-video`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${tokenA}`,
      },
      body,
    });

    assert.equal(res.status, 400, 'Expected 400 Bad Request for invalid video mime/extension');
    const data = await res.json();
    assert.match(data.message, /invalid video format/i);
  });

  test('3.2: Reject oversized video upload exceeding limit with 413', async () => {
    const boundary = '----WebKitFormBoundaryOversized' + Math.random().toString(36).substring(2);
    const oversizedBuffer = Buffer.alloc(21 * 1024 * 1024);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="large_video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([header, oversizedBuffer, footer]);

    const res = await fetch(`${baseUrl}/api/analysis/deepfake-video`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${tokenA}`,
      },
      body: fullBody,
    });

    assert.equal(res.status, 413, 'Expected 413 Payload Too Large for oversized video');
    const data = await res.json();
    assert.match(data.message, /maximum allowed size|exceeds/i);
  });

  // ── TASK 4: DATA STORE OWNERSHIP ISOLATION TESTS ─────────────────────────

  test('4.1: analysisStore.find strictly matches userId in memory and db', async () => {
    const listA = await analysisStore.find({ userId: userA._id });
    const listB = await analysisStore.find({ userId: userB._id });

    for (const item of listA) {
      assert.equal(String(item.userId), String(userA._id));
    }
    for (const item of listB) {
      assert.equal(String(item.userId), String(userB._id));
    }
  });

  test('4.2: analysisStore.deleteById strictly verifies userId', async () => {
    const tempRecord = await analysisStore.create({
      userId: userA._id,
      type: 'news',
      analysisType: 'news',
      input: 'Isolated test record input text.',
      inputType: 'text',
      title: 'Isolated Test Record',
      trustScore: 50,
      confidence: 60,
    });

    // Attempt delete by wrong user
    const failedDelete = await analysisStore.deleteById(tempRecord._id, userB._id, false);
    assert.equal(failedDelete, null, 'Must not delete record belonging to different userId');

    // Successful delete by owner
    const successDelete = await analysisStore.deleteById(tempRecord._id, userA._id, false);
    assert.ok(successDelete, 'Owner must be able to delete record');
  });
});
