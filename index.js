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
    if (!error) {
        const id = isMainThread ? 'Main' : workerData.segment;
        console.log(`Validate Thread: ${id}`);
        // console.log("Region: ", AWS.config.region);
        // console.log("Access key:", AWS.config.credentials.accessKeyId);
        // console.log("Secret key:", AWS.config.credentials.secretAccessKey);
    }

});

// Parent Thread
if (isMainThread) try {

    // Arguments
    const argv = JSON.parse(require('fs').readFileSync(process.argv.pop()));
    /*
    table:     'AWS Table Name'
    segments:  'Number of Segments to divide Table into'
    queue:     'AWS Queue Name'
    dlArn:     'Dead Letter Queue ARN'
    */

    // Log Process
    console.log('Sourcing Started');
    process.on('exit', () => console.log('Sourcing Finished'));

    // Start Worker Segment Threads
    const workers = [];
    for (let i = 0; i < argv.segments; i++)
        workers.push(new Worker(__filename, {
            workerData: {
                ...argv,
                segment: i
            }
        }));

} catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
}

// Worker Segment Threads
if (!isMainThread) (async () => {

    // Create DDB Service Object
    const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

    // DDB Parameters
    const ddbParams = {
        TableName: workerData.table,
        ProjectionExpression: 'pKey',
        TotalSegments: workerData.segments,
        Segment: workerData.segment
    };

    // Create SQS Service Object
    const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

    // SQS Queue URL
    const QueueUrl = (await sqs
        .getQueueUrl({ QueueName: workerData.queue })
        .promise())
        .QueueUrl;

    // Add Dead Letter Queue Policy
    await sqs.setQueueAttributes({
        QueueUrl,
        Attributes: {
            RedrivePolicy: JSON.stringify({
                deadLetterTargetArn: workerData.dlArn,
                maxReceiveCount: 10
            })
        }
    }).promise();

    // Send Items to SQS
    const sendItemsToSQS = items => items.forEach(i => sqs.sendMessage(
        { QueueUrl, MessageBody: i.pKey.S },
        (error, _) => error && console.error(`Error: ${error}`)
    ));

    // Scan Segment Loop
    let incomplete = true;
    while (incomplete) try {
        // Scan Maximum Items
        const data = await ddb.scan(ddbParams).promise();
        // Iterate Next Key
        ddbParams.ExclusiveStartKey = data.LastEvaluatedKey;
        // Update Loop Status
        incomplete = data.LastEvaluatedKey;
        // Send Items to SQS
        sendItemsToSQS(data.Items);
    } catch (error) {
        console.error(`Error: ${error}`);
    }

})();
