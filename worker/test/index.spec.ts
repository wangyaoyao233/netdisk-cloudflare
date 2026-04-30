import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Netdisk worker', () => {
	it('responds to ping (unit style)', async () => {
		const request = new IncomingRequest('http://example.com/ping');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"pong"`);
	});

	it('responds to ping (integration style)', async () => {
		const response = await SELF.fetch('https://example.com/ping');
		expect(await response.text()).toMatchInlineSnapshot(`"pong"`);
	});
});
