
const test = require("node:test");
const assert = require("node:assert/strict");

const { processMessage } = require("../src/consumer");

function createMessage(eventId = "event-001") {
    return {
        Body: JSON.stringify({
            eventId,
            eventType: "OrderCreated",
            data: {
                orderId: "ORD-001",
                customerName: "Rustam",
                amount: 1500
            }
        })
    };
}

test("New event should be saved in DynamoDB", async () => {
    const calls = [];

    const mockDb = {
        async send(command) {
            calls.push(command);

            if (calls.length === 1) {
                return { Item: undefined };
            }

            return {};
        }
    };

    const result = await processMessage(
        createMessage(),
        "test-table",
        mockDb
    );

    assert.equal(result, "processed");
    assert.equal(calls.length, 2);
});

test("Duplicate event should not be saved again", async () => {
    const calls = [];

    const mockDb = {
        async send(command) {
            calls.push(command);
            return {
                Item: { eventId: "event-001" }
            };
        }
    };

    const result = await processMessage(
        createMessage(),
        "test-table",
        mockDb
    );

    assert.equal(result, "duplicate");
    assert.equal(calls.length, 1);
});

test("Event without eventId should be rejected", async () => {
    const message = {
        Body: JSON.stringify({
            eventType: "OrderCreated"
        })
    };

    const mockDb = {
        async send() {
            throw new Error("Database should not be called");
        }
    };

    await assert.rejects(
        processMessage(message, "test-table", mockDb),
        /Event is missing eventId/
    );
});

test("Concurrent duplicate event should be handled safely", async () => {
    let callCount = 0;

    const mockDb = {
        async send(command) {
            callCount++;

            // First call: event does not exist
            if (callCount === 1) {
                return { Item: undefined };
            }

            // Second call: another consumer saved the event first
            const error = new Error("Conditional check failed");
            error.name = "ConditionalCheckFailedException";

            throw error;
        }
    };

    const result = await processMessage(
        createMessage(),
        "test-table",
        mockDb
    );

    assert.equal(result, "duplicate");
    assert.equal(callCount, 2);
});
