const CommandQueue = require("./CommandQueue");

class CommandQueueManager{
    constructor() {
        this.queues = {};
    }

    getQueueForId(id) {
        this.queues[id] = this.queues[id] ?? new CommandQueue();

        return this.queues[id];
    }
}

module.exports = CommandQueueManager;
