import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CircuitOpenError,
  FixedClock,
  Money,
  ProviderError,
  ProviderTimeoutError,
} from '@nabd/shared';

import { MockCardProvider, MockPaymentProvider } from './mock/mock-providers.js';
import {
  CircuitBreaker,
  backoffDelay,
  isSafeToRetry,
  withRetry,
  withTimeout,
} from './resilience.js';

const noSleep = async (): Promise<void> => undefined;
const alwaysRetryable = (): boolean => true;

describe('Timeouts', () => {
  it('rejects a call that overruns', async () => {
    await assert.rejects(
      () => withTimeout(() => new Promise((r) => setTimeout(r, 200)), 20, 'slow-psp'),
      ProviderTimeoutError,
    );
  });

  it('passes through a call that completes in time', async () => {
    const value = await withTimeout(async () => 'done', 1_000, 'fast-psp');
    assert.equal(value, 'done');
  });
});

describe('Retry', () => {
  it('retries a retryable failure and eventually succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new ProviderError('psp', 'transient', true);
        return 'ok';
      },
      {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 5,
        isRetryable: alwaysRetryable,
        sleep: noSleep,
      },
    );
    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
  });

  it('does not retry an error marked non-retryable', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            attempts += 1;
            throw new ProviderError('psp', 'declined', false);
          },
          {
            maxAttempts: 5,
            baseDelayMs: 1,
            maxDelayMs: 5,
            isRetryable: (e) => e instanceof ProviderError && e.retryable,
            sleep: noSleep,
          },
        ),
      ProviderError,
    );
    assert.equal(attempts, 1, 'a declined payment must not be retried');
  });

  it('gives up after maxAttempts', async () => {
    let attempts = 0;
    await assert.rejects(() =>
      withRetry(
        async () => {
          attempts += 1;
          throw new ProviderError('psp', 'always down', true);
        },
        {
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 5,
          isRetryable: alwaysRetryable,
          sleep: noSleep,
        },
      ),
    );
    assert.equal(attempts, 3);
  });

  it('applies jitter so clients do not retry in lockstep', () => {
    // With full jitter, the delay is uniform in [0, exponential).
    const options = { baseDelayMs: 100, maxDelayMs: 10_000 };
    assert.equal(
      backoffDelay(0, options, () => 0),
      0,
    );
    assert.equal(
      backoffDelay(0, options, () => 0.999),
      99,
    );
    assert.equal(
      backoffDelay(3, options, () => 0.5),
      400,
      'grows exponentially',
    );
    assert.equal(
      backoffDelay(20, options, () => 0.999),
      9990,
      'capped by maxDelayMs',
    );
  });

  it('will not retry a write that has no idempotency key', () => {
    assert.equal(isSafeToRetry({ kind: 'READ', hasIdempotencyKey: false }), true);
    assert.equal(isSafeToRetry({ kind: 'WRITE', hasIdempotencyKey: true }), true);
    assert.equal(
      isSafeToRetry({ kind: 'WRITE', hasIdempotencyKey: false }),
      false,
      'retrying this is how a customer gets charged twice',
    );
  });
});

describe('Circuit breaker', () => {
  it('opens after the failure threshold and fails fast', async () => {
    const clock = new FixedClock(0);
    const breaker = new CircuitBreaker(
      'psp',
      { failureThreshold: 3, resetTimeoutMs: 1_000, successThreshold: 1 },
      clock,
    );
    const boom = async (): Promise<never> => {
      throw new ProviderError('psp', 'down', true);
    };

    for (let i = 0; i < 3; i += 1) {
      await assert.rejects(() => breaker.execute(boom), ProviderError);
    }
    assert.equal(breaker.currentState, 'OPEN');

    // Now it fails immediately without touching the provider.
    let called = false;
    await assert.rejects(
      () =>
        breaker.execute(async () => {
          called = true;
          return 'x';
        }),
      CircuitOpenError,
    );
    assert.equal(called, false, 'the provider must not be called while open');
  });

  it('probes after the reset timeout and closes on success', async () => {
    const clock = new FixedClock(0);
    const breaker = new CircuitBreaker(
      'psp',
      { failureThreshold: 2, resetTimeoutMs: 1_000, successThreshold: 2 },
      clock,
    );
    const boom = async (): Promise<never> => {
      throw new ProviderError('psp', 'down', true);
    };

    await assert.rejects(() => breaker.execute(boom), ProviderError);
    await assert.rejects(() => breaker.execute(boom), ProviderError);
    assert.equal(breaker.currentState, 'OPEN');

    clock.advance(1_100);
    assert.equal(await breaker.execute(async () => 'ok'), 'ok');
    assert.equal(breaker.currentState, 'HALF_OPEN', 'one success is not enough');
    assert.equal(await breaker.execute(async () => 'ok'), 'ok');
    assert.equal(breaker.currentState, 'CLOSED');
  });

  it('reopens immediately if the probe fails', async () => {
    const clock = new FixedClock(0);
    const breaker = new CircuitBreaker(
      'psp',
      { failureThreshold: 1, resetTimeoutMs: 1_000, successThreshold: 2 },
      clock,
    );
    await assert.rejects(
      () =>
        breaker.execute(async () => {
          throw new ProviderError('psp', 'down', true);
        }),
      ProviderError,
    );
    clock.advance(1_100);
    await assert.rejects(
      () =>
        breaker.execute(async () => {
          throw new ProviderError('psp', 'still down', true);
        }),
      ProviderError,
    );
    assert.equal(breaker.currentState, 'OPEN', 'a failed probe must not reset the counter');
  });
});

describe('Mock payment provider', () => {
  it('is marked as not handling real value', () => {
    const psp = new MockPaymentProvider();
    assert.equal(psp.identity.handlesRealValue, false);
    assert.equal(new MockCardProvider().identity.handlesRealValue, false);
  });

  it('honours the idempotency key, so a retry does not charge twice', async () => {
    const psp = new MockPaymentProvider(
      undefined,
      { autoComplete: true },
      new FixedClock(1_756_000_000_000),
    );
    const request = {
      idempotencyKey: 'idem-1',
      reference: 'NBD-1',
      amount: Money.fromMajor('250.00', 'SAR'),
      description: 'Test',
      method: 'CARD' as const,
      customerRef: 'cust_1',
    };

    const first = await psp.createPayment(request);
    const retry = await psp.createPayment(request);
    assert.equal(
      retry.providerPaymentId,
      first.providerPaymentId,
      'a retried create must return the original payment',
    );
  });

  it('verifies webhook signatures over the raw body', () => {
    const psp = new MockPaymentProvider('shared-secret-value');
    const body = JSON.stringify({ type: 'payment.completed', id: 'pay_1' });
    const signature = psp.signWebhook(body);

    assert.equal(psp.verifyWebhook(body, { 'x-nabd-signature': signature }), true);
    assert.equal(psp.verifyWebhook(body, {}), false, 'unsigned webhooks are rejected');
    assert.equal(
      psp.verifyWebhook(body, { 'x-nabd-signature': 'a'.repeat(64) }),
      false,
      'a forged signature is rejected',
    );

    // Any change to the body invalidates the signature — this is what stops a
    // forged "payment.completed" from crediting an account.
    const tampered = JSON.stringify({ type: 'payment.completed', id: 'pay_ATTACKER' });
    assert.equal(psp.verifyWebhook(tampered, { 'x-nabd-signature': signature }), false);
  });

  it('refuses to refund a payment that never completed', async () => {
    const psp = new MockPaymentProvider(undefined, { autoComplete: false });
    const payment = await psp.createPayment({
      idempotencyKey: 'idem-2',
      reference: 'NBD-2',
      amount: Money.fromMajor('10.00', 'SAR'),
      description: 'Test',
      method: 'QR',
      customerRef: 'cust_1',
    });
    assert.equal(payment.status, 'PENDING');
    await assert.rejects(
      () =>
        psp.refundPayment({
          idempotencyKey: 'idem-3',
          reference: 'NBD-3',
          providerPaymentId: payment.providerPaymentId,
          reason: 'test',
        }),
      ProviderError,
    );
  });

  it('surfaces simulated failures so retry paths can be exercised', async () => {
    const psp = new MockPaymentProvider(undefined, {
      failNextCalls: 2,
      autoComplete: true,
    });
    let attempts = 0;
    const payment = await withRetry(
      async () => {
        attempts += 1;
        return psp.createPayment({
          idempotencyKey: 'idem-4',
          reference: 'NBD-4',
          amount: Money.fromMajor('5.00', 'SAR'),
          description: 'Test',
          method: 'WALLET',
          customerRef: 'cust_1',
        });
      },
      {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 2,
        isRetryable: alwaysRetryable,
        sleep: noSleep,
      },
    );
    assert.equal(attempts, 3);
    assert.equal(payment.status, 'COMPLETED');
  });
});

describe('Mock card provider', () => {
  it('never exposes a PAN or CVV', async () => {
    const issuer = new MockCardProvider();
    const card = await issuer.issueCard({
      idempotencyKey: 'card-1',
      reference: 'NBD-C1',
      customerRef: 'cust_1',
      type: 'VIRTUAL',
      currency: 'SAR',
    });

    const serialised = JSON.stringify(card);
    assert.match(card.last4, /^\d{4}$/);
    for (const forbidden of ['pan', 'cvv', 'cvc', 'cardNumber', 'number']) {
      assert.ok(
        !Object.keys(card).some((k) => k.toLowerCase() === forbidden.toLowerCase()),
        `card object must not carry ${forbidden}`,
      );
    }
    assert.ok(
      !/\b\d{13,19}\b/.test(serialised),
      'no full card number anywhere in the payload',
    );
  });

  it('refuses to unfreeze a cancelled card', async () => {
    const issuer = new MockCardProvider();
    const card = await issuer.issueCard({
      idempotencyKey: 'card-2',
      reference: 'NBD-C2',
      customerRef: 'cust_1',
      type: 'VIRTUAL',
      currency: 'SAR',
    });
    await issuer.terminateCard(card.providerCardId);
    await assert.rejects(() => issuer.unfreezeCard(card.providerCardId), ProviderError);
  });
});
