
class CommandQueue {
    constructor() {
        this.commands = [];
    }

    enqueue(cmd) {
        this.commands.push(cmd);

        if (this.commands.length > CommandQueue.MAX_LEN) {
            this.commands.shift();
        }
    }

    getNext() {
        return this.commands.shift();
    }
}

CommandQueue.MAX_LEN = 10;

module.exports = CommandQueue;
