const CommandQueueManager = require("./src/CommandQueueManager");
const DummyCloud = require("./src/DummyCloud");
const Logger = require("./src/Logger");
const MqttClient = require("./src/MqttClient");

if (process.env.LOGLEVEL) {
    Logger.setLogLevel(process.env.LOGLEVEL);
}

const commandQueueManager = new CommandQueueManager();

const dummyCloud = new DummyCloud(commandQueueManager);
const mqttClient = new MqttClient(dummyCloud, commandQueueManager);

dummyCloud.initialize();
mqttClient.initialize();
