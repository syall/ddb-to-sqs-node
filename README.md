# ddb-to-sqs-node

## Overview

The goal of the project is to transfer [DynamoDB](#dynamodb) records to an [SQS](#sqs) queue, utilizing the [AWS SDK for Javascript in Node.js](https://aws.amazon.com/sdk-for-node-js/).

Key features for the script include:

* [Validation](#validation)
* [Parallel Scanning](#parallel-scanning)

## Prerequisites

In order to use the script, the [AWS CLI](https://aws.amazon.com/cli/) needs to be configured with these attributes for validation using the `aws configure` command:

* Region
* Access Key
* Secret Key

For a more in-depth guide, follow the instructions [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html).

Also, the program works under the assumption the table will not have any updates during the process. Modifying any record in the DynamoDB table would lead to incorrect scans (breaking segments or incorrect reading data).

## Usage

```shell
node index.js <path/to/input>.json
```

## Parameters

The program takes a file path of a JSON file defining four parameters:

Parameter | Type | Description
--- | --- | ---
table | String | AWS Table Name
segments | Number | Number of Segments to divide the Table into
queue | String | AWS Queue Name
dlArn | String | Dead Letter Queue ARN

For an example input, look at [`example-input.json`](https://github.com/syall/ddb-to-sqs-node/blob/master/example-input.json).

## Validation

One of the key design considerations was credential validation, especially since the script works with Worker Threads. To manage this, the top of the script begins with [`AWS.config.getCredentials`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#getCredentials-property) that prints out the thread segment number, guaranteeing that each thread is validated.

## Parallel Scanning

Scanning a table, especially tables with millions of records, can take a tremendous amount of time. As a solution, the SDK allows for [parallel scanning](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html#Scan.ParallelScan).

In the script, the total number of segments is taken from the argument `segments`. The main thread then created a new Worker for each segment, using the segment number as an unique ID. Each thread will scan the assigned segment of the table while completely isolated from the other segments.

## Main Thread

The main thread is the entry point of the script (determined by `isMainThread`), and does three tasks:

* Read the input file from the command line
* Start Worker Threads based on arguments
* Log the beginning and end of the process

## Worker Threads

The [Worker threads](https://nodejs.org/api/worker_threads.html#) are wrapped by an async [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) and receive arguments through `workerData`. The three main components of the Worker Threads are DynamoDB, SQS, and the Scanning/Messaging Loop.

### DynamoDB

[DynamoDB](https://aws.amazon.com/dynamodb/) is a highly efficient NoSQL Database service running on AWS. In this case, Records are [scanned](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#scan-property) from a specified table in DynamoDB via the `table` and `segment` arguments.

### SQS

[SQS](https://aws.amazon.com/sqs/) is a Message Queue service provided by AWS for high throughput applications. In this case, Records from DynamoDB are individually [sent](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessage-property) to a specified queue or corresponding [dead-letter queue](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) via the `queue` and `dlArn` arguments.

[`sendMessageBatch`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessageBatch-property) was not used since it requires that each message have an `Id`. To assign an `Id` to each message would require creating new objects for each record, taking up both unnecessary time and space (especially with high volume scans).

### Scanning/Messaging Loop

The loop holds all of the business logic for the script and has this basic workflow:

0. `ddbParams` holds the parameters for scanning the DynamoDB Table
1. Scan the Table to get back `Items` and `LastEvaluatedKey`
2. Update the `ExclusiveStartKey` parameter in `ddbParams` to `LastEvaluatedKey`
3. For each item in `Items`, send the record as a message to the `queue` URL
4. If the `ExclusiveStartKey` is not null, then go to step 1

The condition of the loop depends on `ExclusiveStartKey`: if the `ExclusiveStartKey` is empty, then there are no more records to scan from the Table.

Also, if there is an error in scanning, the `ExclusiveStartKey` would stay the same, attempting to scan the table using the same `ExclusiveStartKey` from the last iteration.

## Personal Notes

The project spanned a lot of concepts, particularly using AWS for the first time. Here are some of my takeaways:

* Keeping both main and workerthread  code in one file is easier than spreading code among different files, especially for simple scripts like this one
* Taking inputs as JSON is supremely easier than managing command line arguments
* Using an async IIFE replaces top level async/await
* Many AWS functions can be "promisfied" using [`.promise`](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/using-promises.html), making them compatible with async/await
* Coming up with a solution makes it easier to think of which AWS services to use, [#workingBackwards](https://www.quora.com/What-is-Amazons-approach-to-product-development-and-product-management?ref=http://www.product-frameworks.com/)

The script is a lightweight proof-of-concept inspired by my internship at Amazon, but is NOT written during company time and is NOT copied from any Amazon intellectual property.
