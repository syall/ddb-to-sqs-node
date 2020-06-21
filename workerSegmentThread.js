// Worker Data
const { workerData } = require('worker_threads');

// Validate Credentials
require('./validateCredentials')();

// AWS SDK
const AWS = require('aws-sdk');

// Worker Segment Thread
const workerSegmentThread = async () => {

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
        (error, _) => error && console.error(`Error: ${error}, ${i.pKey.S}`)
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
        console.error(`LastEvaluatedKey: ${ddbParams.ExclusiveStartKey}`);
    }

};

module.exports = workerSegmentThread;
