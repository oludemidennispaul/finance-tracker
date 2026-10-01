import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth.js';
import { pool } from '../src/db.js';

test('passwords hash and verify', async () => {
  const hash = await hashPassword('correct horse');
  assert.match(hash, /^scrypt\$/);
  assert.notEqual(hash, await hashPassword('correct horse')); // salted
  assert.equal(await verifyPassword('correct horse', hash), true);
  assert.equal(await verifyPassword('wrong horse', hash), false);
  assert.equal(await verifyPassword('anything', 'garbage'), false);
  await pool.end(); // auth.js imports the pool; close it so the test exits
});
