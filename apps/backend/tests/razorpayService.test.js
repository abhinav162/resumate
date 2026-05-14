import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebhookSignature } from '../src/services/razorpayService.js';

const SECRET = 'whsec_test_value';

function signedBody(secret, payloadObj) {
  const body = JSON.stringify(payloadObj);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return { body, signature };
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed body', () => {
    const { body, signature } = signedBody(SECRET, {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_xxx' } } },
    });
    assert.equal(verifyWebhookSignature(Buffer.from(body), signature, SECRET), true);
  });

  it('rejects a tampered body with the original signature', () => {
    const { signature } = signedBody(SECRET, { event: 'payment.captured', payload: {} });
    const tampered = JSON.stringify({ event: 'payment.captured', payload: { hacked: true } });
    assert.equal(verifyWebhookSignature(Buffer.from(tampered), signature, SECRET), false);
  });

  it('rejects a body signed with the wrong secret', () => {
    const { body } = signedBody(SECRET, { event: 'payment.captured', payload: {} });
    const wrongSig = crypto.createHmac('sha256', 'whsec_wrong').update(body).digest('hex');
    assert.equal(verifyWebhookSignature(Buffer.from(body), wrongSig, SECRET), false);
  });

  it('returns false on missing signature', () => {
    const { body } = signedBody(SECRET, { event: 'payment.captured' });
    assert.equal(verifyWebhookSignature(Buffer.from(body), undefined, SECRET), false);
  });

  it('throws when webhook secret is not set', () => {
    const { body, signature } = signedBody(SECRET, { event: 'payment.captured' });
    assert.throws(
      () => verifyWebhookSignature(Buffer.from(body), signature, ''),
      /RAZORPAY_WEBHOOK_SECRET not set/
    );
  });
});
