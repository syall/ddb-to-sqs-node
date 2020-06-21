// Worker Class
const { Worker } = require('worker_threads');

// Validate Credentials
require('./validateCredentials')();

// Main Thread
const mainThread = argv => {
    try {

        // Log Process
        console.log('Sourcing Started');
        process.on('exit', () => console.log('Sourcing Finished'));

        // Start Worker Segment Threads
        const workers = [];
        for (let i = 0; i < argv.segments; i++)
            workers.push(new Worker('./workerSegmentThread.js', {
                workerData: {
                    ...argv,
                    segment: i
                }
            }));

    } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
    }
};

module.exports = mainThread;
