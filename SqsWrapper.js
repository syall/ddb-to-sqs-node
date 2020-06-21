// AWS SDK
const AWS = require('aws-sdk');

module.exports = class SqsWrapper {

    constructor({ queue, dlArn }) {

        // Create SQS Service Object
        this.instance = new AWS.SQS({ apiVersion: '2012-11-05' });

        // Get Queue URL
        this.QueueUrl = this.getQueueUrl(queue);

        // Set Queue Attributes
        this.setQueueAttributes(dlArn);

    }

    async getQueueUrl(queue) {
        // Get Queue URL
        return (await this.instance.getQueueUrl({ QueueName: queue }).promise())
            .QueueUrl;
    }

    async setQueueAttributes(dlArn) {
        // Set Queue Attributes
        await this.instance
            .setQueueAttributes({
                QueueUrl: this.QueueUrl,
                Attributes: {
                    // Set Dead Letter Queue
                    RedrivePolicy: JSON.stringify({
                        deadLetterTargetArn: dlArn,
                        maxReceiveCount: 10
                    })
                }
            })
            .promise();
    }

    sendItemsToSQS(items) {
        for (const i of items)
            // Send Message to SQS
            this.instance.sendMessage(
                // Primary Key as Message Body
                { QueueUrl: this.QueueUrl, MessageBody: i.pKey.S },
                (error, _) => error
                    ? console.error(`Error: ${error}, ${i.pKey.S}`)
                    : console.log(`Success: ${i.pKey.S}`)
            );
    }

};
