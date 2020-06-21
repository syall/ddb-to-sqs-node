/** DynamoDB to SQS AWS Application
 * Arguments
 * table:     'AWS Table Name'
 * segments:  'Number of Segments to divide Table into'
 * queue:     'AWS Queue Name'
 * dlArn:     'Dead Letter Queue ARN'
 */

// Worker Threads
const { Worker, isMainThread, workerData } = require('worker_threads');

// Thread Branching
(isMainThread)
    // Main Thread
    ? require('./mainThread')(JSON.parse(require('fs').readFileSync(process.argv.pop())))
    // Worker Segment Thread
    : require('./workerSegmentThread')();
