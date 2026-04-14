const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function createMockResponse() {
    return {
        statusCode: 200,
        payload: null,
        view: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return this;
        },
        render(view) {
            this.view = view;
            return this;
        }
    };
}

function loadLogicsWithMocks({ poolMock, paymentCallbackMock = async () => {} }) {
    const databasePath = require.resolve('../config/database');
    const simulationPath = require.resolve('../controllers/simulation');
    const logicsPath = require.resolve('../controllers/logics');

    delete require.cache[databasePath];
    delete require.cache[simulationPath];
    delete require.cache[logicsPath];

    require.cache[databasePath] = {
        id: databasePath,
        filename: databasePath,
        loaded: true,
        exports: poolMock
    };

    require.cache[simulationPath] = {
        id: simulationPath,
        filename: simulationPath,
        loaded: true,
        exports: {
            simulatePaymentGatewayCallback: paymentCallbackMock
        }
    };

    const logics = require('../controllers/logics');

    return {
        logics,
        cleanup() {
            delete require.cache[databasePath];
            delete require.cache[simulationPath];
            delete require.cache[logicsPath];
        }
    };
}

test('PostPayments rejects invalid phone and does not query DB', async () => {
    const poolMock = {
        query: async () => {
            throw new Error('DB should not be touched for invalid input');
        }
    };

    const { logics, cleanup } = loadLogicsWithMocks({ poolMock });
    try {
        const req = { body: { phone: '123', amount: 5000 } };
        const res = createMockResponse();

        await logics.PostPayments(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.payload.message, 'Phone number must be 10 digits');
    } finally {
        cleanup();
    }
});

test('webhook rejects stale callbacks before DB transaction', async () => {
    const poolMock = {
        query: async () => {
            throw new Error('DB should not be touched for stale callback');
        }
    };

    const { logics, cleanup } = loadLogicsWithMocks({ poolMock });
    try {
        const originalSecret = process.env.WEBHOOK_SECRET;
        const originalMaxAge = process.env.WEBHOOKMAXAGE;

        process.env.WEBHOOK_SECRET = 'unit-test-secret';
        process.env.WEBHOOKMAXAGE = '300000';

        const reference = 'ORD123456';
        const status = 'SUCCESS';
        const timestamp = Date.now() - 301000;
        const signature = crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET)
            .update(reference + status + timestamp + process.env.WEBHOOK_SECRET)
            .digest('hex');

        const req = { body: { reference, status, timestamp, signature } };
        const res = createMockResponse();

        await logics.webhook(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.payload.message, 'Stale callback rejected');

        process.env.WEBHOOK_SECRET = originalSecret;
        process.env.WEBHOOKMAXAGE = originalMaxAge;
    } finally {
        cleanup();
    }
});

test('webhook rolls back when transaction is already finalized', async () => {
    const calls = [];
    const poolMock = {
        query: async (sql) => {
            calls.push(sql);
            if (sql === 'BEGIN') {
                return {};
            }
            if (sql.includes('SELECT * FROM transactions WHERE reference')) {
                return { rowCount: 1, rows: [{ status: 'SUCCESS' }] };
            }
            if (sql === 'ROLLBACK') {
                return {};
            }
            throw new Error(`Unexpected SQL in test: ${sql}`);
        }
    };

    const { logics, cleanup } = loadLogicsWithMocks({ poolMock });
    try {
        const originalSecret = process.env.WEBHOOK_SECRET;
        const originalMaxAge = process.env.WEBHOOKMAXAGE;

        process.env.WEBHOOK_SECRET = 'unit-test-secret';
        process.env.WEBHOOKMAXAGE = '300000';

        const reference = 'ORD789';
        const status = 'FAILED';
        const timestamp = Date.now();
        const signature = crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET)
            .update(reference + status + timestamp + process.env.WEBHOOK_SECRET)
            .digest('hex');

        const req = { body: { reference, status, timestamp, signature } };
        const res = createMockResponse();

        await logics.webhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.payload.message, 'Already finalized');
        assert.deepEqual(calls, [
            'BEGIN',
            'SELECT * FROM transactions WHERE reference = $1',
            'ROLLBACK'
        ]);

        process.env.WEBHOOK_SECRET = originalSecret;
        process.env.WEBHOOKMAXAGE = originalMaxAge;
    } finally {
        cleanup();
    }
});
