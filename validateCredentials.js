// Worker Threads
const { isMainThread, workerData } = require('worker_threads');

// AWS SDK
const AWS = require('aws-sdk');

// Validate Credentials and Region
const validateCredentials = () => AWS.config.getCredentials(error => {
    // Configuration Error
    if (error) {
        console.error(error.stack);
        process.exit(1);
    }
    // Log Thread Validation
    else {
        const id = isMainThread ? 'Main' : workerData.segment;
        console.log(`Validate Thread: ${id}`);
        // console.log("Region: ", AWS.config.region);
        // console.log("Access key:", AWS.config.credentials.accessKeyId);
        // console.log("Secret key:", AWS.config.credentials.secretAccessKey);
    }
});

module.exports = validateCredentials;
