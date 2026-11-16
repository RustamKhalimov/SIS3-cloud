
const express = require("express");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { createOrderCreatedEvent } = require("./src/events");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

const sns = new SNSClient({
    region: process.env.AWS_REGION || "eu-central-1"
});

// Main endpoint
app.get("/", (req, res) => {
    res.json({
        message: "SIS 3 Order Processing API",
        version: "1.0.0"
    });
});

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok"
    });
});

// Create order and publish domain event
app.post("/orders", async (req, res) => {
    const { orderId, customerName, amount } = req.body;

    if (!orderId || !customerName || amount === undefined) {
        return res.status(400).json({
            error: "orderId, customerName and amount are required"
        });
    }

    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
            error: "amount must be a positive number"
        });
    }

    const event = createOrderCreatedEvent({
        orderId,
        customerName,
        amount
    });

    try {
        const topicArn = process.env.SNS_TOPIC_ARN;

        if (!topicArn) {
            return res.status(500).json({
                error: "SNS_TOPIC_ARN environment variable is missing"
            });
        }

        const command = new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify(event)
        });

        const result = await sns.send(command);

        return res.status(201).json({
            message: "Order created and event published",
            eventId: event.eventId,
            messageId: result.MessageId,
            order: event.data
        });

    } catch (error) {
        console.error("SNS publishing error:", error);

        return res.status(500).json({
            error: "Failed to publish order event"
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});
