const bodyParser = require("body-parser");
const EventEmitter = require("events").EventEmitter;
const express = require("express");
const Logger = require("./Logger");


class DummyCloud {
    /**
     * @param {import("./CommandQueueManager")} commandQueueManager
     */
    constructor(commandQueueManager) {
        this.commandQueueManager = commandQueueManager;

        this.eventEmitter = new EventEmitter();
        this.app = express();
    }

    initialize() {
        this.app.use(bodyParser.json());

        this.app.post("/sensors/airgradient::sensorId/measures", (req, res) => {
            const nextCommand = this.commandQueueManager.getQueueForId(req.params.sensorId).getNext();

            if (nextCommand) {
                Logger.debug(`Next command for ${req.params.sensorId} is ${nextCommand}`);
            } else {
                Logger.trace(`No command queued for ${req.params.sensorId}`);
            }


            if (Object.keys(req.body).length > 2) {  //Hacky way to ignore pings
                this.emitData({
                    id: req.params.sensorId,
                    payload: req.body
                });
            }

            res.status(200).send(nextCommand ?? "OK");
        });


        this.app.listen(DummyCloud.PORT, () => {
            Logger.info(`Airgradient DummyCloud listening on port ${DummyCloud.PORT}`);
        });
    }

    emitData(data) {
        this.eventEmitter.emit(DummyCloud.EVENTS.Data, data);
    }

    onData(listener) {
        this.eventEmitter.on(DummyCloud.EVENTS.Data, listener);
    }
}

DummyCloud.EVENTS = {
    Data: "Data",
};


DummyCloud.PORT = !isNaN(parseInt(process.env.CLOUD_PORT)) ? process.env.CLOUD_PORT : 80;

module.exports = DummyCloud;
