
const test = require("node:test");
const assert = require("node:assert/strict");

const { createOrderCreatedEvent } = require("../src/events");

test("Event should have OrderCreated type", () => {
    const event = createOrderCreatedEvent({
        orderId: "ORD-001",
        customerName: "Rustam",
        amount: 1500
    });

    assert.equal(event.eventType, "OrderCreated");
});

test("Each event should have a unique eventId", () => {
    const order = {
        orderId: "ORD-001",
        customerName: "Rustam",
        amount: 1500
    };

    const event1 = createOrderCreatedEvent(order);
    const event2 = createOrderCreatedEvent(order);

    assert.ok(event1.eventId);
    assert.notEqual(event1.eventId, event2.eventId);
});

test("Event should contain correct order data", () => {
    const event = createOrderCreatedEvent({
        orderId: "ORD-001",
        customerName: "Rustam",
        amount: 1500
    });

    assert.deepEqual(event.data, {
        orderId: "ORD-001",
        customerName: "Rustam",
        amount: 1500
    });
});

test("Event should contain a valid ISO date", () => {
    const event = createOrderCreatedEvent({
        orderId: "ORD-001",
        customerName: "Rustam",
        amount: 1500
    });

    assert.ok(!Number.isNaN(Date.parse(event.occurredAt)));
    assert.equal(new Date(event.occurredAt).toISOString(), event.occurredAt);
});
