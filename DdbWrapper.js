// AWS SDK
const AWS = require('aws-sdk');

module.exports = class DdbWrapper {

    constructor({ table, segments, segment }) {

        // DDB Service Object
        this.instance = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

        // DDB Parameters
        this.params = {
            TableName: table,
            ProjectionExpression: 'pKey',
            TotalSegments: segments,
            Segment: segment,
            ExclusiveStartKey: null
        };

    }

    async scan() {

        // Scan
        const { Items, LastEvaluatedKey } = await this.instance
            .scan(this.params)
            .promise();

        // Iterate Key
        this.params.ExclusiveStartKey = LastEvaluatedKey;

        // Return Items
        return Items;
    }

};
