
const {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand
} = require("@aws-sdk/client-sqs");

const {
    DynamoDBClient
} = require("@aws-sdk/client-dynamodb");

const {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand
} = require("@aws-sdk/lib-dynamodb");

// AWS SQS client
const sqs = new SQSClient({
    region: process.env.AWS_REGION || "eu-central-1"
});

// AWS DynamoDB client
const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: process.env.AWS_REGION || "eu-central-1"
    })
);

// Process one SQS message
async function processMessage(message, tableName, db = dynamoClient) {
    const event = JSON.parse(message.Body);

    if (!event.eventId) {
        throw new Error("Event is missing eventId");
    }

    // Check whether the event was already processed
    const existingEvent = await db.send(
        new GetCommand({
            TableName: tableName,
            Key: {
                eventId: event.eventId
            }
        })
    );

    if (existingEvent.Item) {
        console.log(`Duplicate event skipped: ${event.eventId}`);
        return "duplicate";
    }

    // Save event ID to DynamoDB
    try {
        await db.send(
            new PutCommand({
                TableName: tableName,
                Item: {
                    eventId: event.eventId,
                    eventType: event.eventType,
                    processedAt: new Date().toISOString()
                },
                ConditionExpression: "attribute_not_exists(eventId)"
            })
        );
    } catch (error) {
        // Handle concurrent duplicate processing
        if (error.name === "ConditionalCheckFailedException") {
            console.log(`Duplicate event skipped: ${event.eventId}`);
            return "duplicate";
        }

        throw error;
    }

    console.log(`Event processed: ${event.eventId}`);

    return "processed";
}

// Receive and process messages from SQS
async function pollQueue() {
    const queueUrl = process.env.SQS_QUEUE_URL;
    const tableName = process.env.DYNAMODB_TABLE_NAME;

    if (!queueUrl || !tableName) {
        throw new Error(
            "SQS_QUEUE_URL and DYNAMODB_TABLE_NAME are required"
        );
    }

    const response = await sqs.send(
        new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 10
        })
    );

    for (const message of response.Messages || []) {
        try {
            await processMessage(message, tableName);

            // Delete message only after successful processing
            await sqs.send(
                new DeleteMessageCommand({
                    QueueUrl: queueUrl,
                    ReceiptHandle: message.ReceiptHandle
                })
            );

        } catch (error) {
            console.error("Message processing failed:", error);
        }
    }
}

module.exports = {
    processMessage,
    pollQueue
};
