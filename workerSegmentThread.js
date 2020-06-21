// Worker Data
const { workerData } = require('worker_threads');

// Validate Credentials
require('./validateCredentials')();

// Worker Segment Thread
const workerSegmentThread = async () => {

    // Create DDB Wrapper
    const ddb = require('./DdbWrapper')(workerData);

    // Create SQS Wrapper
    const sqs = require('./SqsWrapper')(workerData);

    // Scan Segment Loop
    do {
        try {
            // Scan Items
            const items = await ddb.scan();
            // Send Items
            sqs.sendItemsToSQS(items);
        } catch (error) {
            console.error(`Error: ${error}`);
            console.error(`LastEvaluatedKey: ${ddb.params.ExclusiveStartKey}`);
        }
    } while (ddb.params.ExclusiveStartKey);

};


module.exports = workerSegmentThread;
