
const { randomUUID } = require("crypto");

function createOrderCreatedEvent(order) {
    return {
        eventId: randomUUID(),
        eventType: "OrderCreated",
        occurredAt: new Date().toISOString(),
        data: {
            orderId: order.orderId,
            customerName: order.customerName,
            amount: order.amount
        }
    };
}

module.exports = {
    createOrderCreatedEvent
};
