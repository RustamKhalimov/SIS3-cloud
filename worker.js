
const { pollQueue } = require("./src/consumer");

async function startWorker() {
    console.log("SQS Worker started");

    while (true) {
        try {
            await pollQueue();
        } catch (error) {
            console.error("Worker polling error:", error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

startWorker();
