/** DynamoDB to SQS AWS Application
 * Parameters
 * table:     'AWS Table Name (String)'
 * segments:  'Number of Segments to divide the Table into (Number)'
 * queue:     'AWS Queue Name (String)'
 * dlArn:     'Dead Letter Queue ARN (String)'
 */
// Worker Threads
const { Worker, isMainThread, workerData } = require('worker_threads');
// AWS SDK
const AWS = require('aws-sdk');
// Validate Credentials and Region
AWS.config.getCredentials(error => {
    // Configuration Error
    if (error) {
        console.error(error.stack);
        process.exit(1);
    }
    // Log Thread Validation
    else {
        const id = isMainThread ? 'Main' : workerData.segment;
        console.log(`Validate Thread: ${id}`);
        // Log Region, Access Key, and Secret Key
        // console.log("Region: ", AWS.config.region);
        // console.log("Access key:", AWS.config.credentials.accessKeyId);
        // console.log("Secret key:", AWS.config.credentials.secretAccessKey);
    }
});
// Main Thread
if (isMainThread) {
    try {
        // Arguments
        const argv = JSON.parse(require('fs').readFileSync(process.argv.pop()));
        // Logging
        console.log('Sourcing Started');
        process.on('exit', () => console.log('Sourcing Finished'));
        // Start Worker Segment Threads
        for (let i = 0; i < argv.segments; i++)
            new Worker(__filename, { workerData: { ...argv, segment: i } });
    } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
    }
}
// Worker Segment Thread
else (async _ => {
    // Deconstruct Worker Data
    const { table, segments, segment, queue, dlArn } = workerData;
    // DDB
    const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
    const ddbParams = {
        TableName: table,
        ProjectionExpression: 'pKey',
        TotalSegments: segments,
        Segment: segment,
        ExclusiveStartKey: null
    };
    // SQS
    const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
    const { QueueUrl } = await sqs
        .getQueueUrl({ QueueName: queue })
        .promise();
    sqs.setQueueAttributes({
        QueueUrl,
        Attributes: {
            RedrivePolicy: JSON.stringify({
                deadLetterTargetArn: dlArn, maxReceiveCount: 10
            })
        }
    }).promise();
    // Scan Segment Loop
    do {
        try {
            // Scan Items
            const { Items, LastEvaluatedKey } = await ddb
                .scan(ddbParams)
                .promise();
            // Iterate Key
            ddbParams.ExclusiveStartKey = LastEvaluatedKey;
            // Send Items
            Items.forEach(i => sqs.sendMessage(
                { QueueUrl, MessageBody: i.pKey.S },
                (error, _) => error
                    ? console.error(`Error: ${error}, ${i.pKey.S}`)
                    : console.log(`Success: ${i.pKey.S}`)
            ));
        } catch (error) {
            console.error(`Error: ${error}`);
            console.error(`LastEvaluatedKey: ${ddbParams.ExclusiveStartKey}`);
        }
    } while (ddbParams.ExclusiveStartKey);
})();
