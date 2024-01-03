const Logger = require("./Logger");
const mqtt = require("mqtt");


class MqttClient {
    /**
     * 
     * @param {import("./DummyCloud")} dummyCloud
     * @param {import("./CommandQueueManager")} commandQueueManager
     */
    constructor(dummyCloud, commandQueueManager) {
        this.dummyCloud = dummyCloud;
        this.commandQueueManager = commandQueueManager;

        this.autoconfTimestamps = {};

        this.dummyCloud.onData((data) => {
            this.handleData(data);
        });
    }

    initialize() {
        const options = {
            clientId: `airgradient2mqtt_${Math.random().toString(16).slice(2, 9)}`,  // 23 characters allowed
        };

        if (process.env.MQTT_USERNAME) {
            options.username = process.env.MQTT_USERNAME;

            if (process.env.MQTT_PASSWORD) {
                options.password = process.env.MQTT_PASSWORD;
            }
        } else if (process.env.MQTT_PASSWORD) {
            // MQTT_PASSWORD is set but MQTT_USERNAME is not
            Logger.error("MQTT_PASSWORD is set but MQTT_USERNAME is not. MQTT_USERNAME must be set if MQTT_PASSWORD is set.");
            process.exit(1);
        }

        if (process.env.MQTT_CHECK_CERT) {
            options.rejectUnauthorized = (process.env.MQTT_CHECK_CERT !== "false");
        }

        this.client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

        this.client.on("connect", () => {
            Logger.info("Connected to MQTT broker");

            this.client.subscribe(`${MqttClient.TOPIC_PREFIX}/+/+/set`, (err, granted) => {
                if (!err) {
                    Logger.info("Successfully subscribed to MQTT command topics", granted);
                } else {
                    Logger.warn("Error while subscribing to MQTT command topics", err);
                }
            });
        });

        this.client.on("error", (e) => {
            if (e && e.message === "Not supported") {
                Logger.info("Connected to non-standard-compliant MQTT Broker.");
            } else {
                Logger.error("MQTT error:", e.toString());
            }
        });

        this.client.on("reconnect", () => {
            Logger.info("Attempting to reconnect to MQTT broker");
        });

        this.client.on("message", (topic, message) => {
            const splitTopic = topic.split("/");
            const msg = message.toString();
            const id = splitTopic[1];
            const target = splitTopic[2];

            switch (target) {
                case "rgb_bri":
                    this.commandQueueManager.getQueueForId(id).enqueue(`CMD_RGB_BRI_${msg}`);

                    Logger.debug(`Successfully queued RGB BRI command for ${id} with payload ${msg}`);
                    break;
                case "oled_bri":
                    this.commandQueueManager.getQueueForId(id).enqueue(`CMD_OLED_BRI_${msg}`);

                    Logger.debug(`Successfully queued OLED BRI command for ${id} with payload ${msg}`);
                    break;
                case "do_reboot":
                    this.commandQueueManager.getQueueForId(id).enqueue("CMD_REBOOT");

                    Logger.debug(`Successfully queued REBOOT command for ${id}`);
                    break;
                case "do_reset_wifi":
                    this.commandQueueManager.getQueueForId(id).enqueue("CMD_RESET_WIFI");

                    Logger.debug(`Successfully queued RESET WIFI command for ${id}`);
                    break;
                default:
                    Logger.warn(`Received unknown command ${target} for ${id} with payload ${msg}`);
            }
        });
    }

    handleData(data) {
        this.ensureAutoconf(data.id, data.payload);
        const baseTopic = `${MqttClient.TOPIC_PREFIX}/${data.id.toString()}`;

        Object.keys(data.payload).forEach(key => {
            if (typeof data.payload[key] !== "object") {
                this.client.publish(`${baseTopic}/${key}`, data.payload[key].toString());
            }

            if (key === "channels") {
                Object.keys(data.payload["channels"]).forEach(channelKey => {
                    Object.keys(data.payload["channels"][channelKey]).forEach(key => {
                        this.client.publish(`${baseTopic}/channel_${channelKey}_${key}`, data.payload[key].toString());
                    });
                });
            }
        });
    }

    ensureAutoconf(sensorId, payload) {
        // (Re-)publish every 4 hours
        if (Date.now() - (this.autoconfTimestamps[sensorId] ?? 0) <= 4 * 60 * 60 * 1000) {
            return;
        }
        const baseTopic = `${MqttClient.TOPIC_PREFIX}/${sensorId.toString()}`;
        const device = {
            "manufacturer":"AirGradient",
            "model":"Air Quality Sensor",
            "name":`Air Quality Sensor ${sensorId}`,
            "identifiers":[
                `airgradient2mqtt_${sensorId}`
            ]
        };

        Object.keys(payload).forEach(key => {
            switch (key) {
                case "wifi": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "name":"Wi-Fi Signal",
                            "unit_of_measurement": "dBm",
                            "device_class": "signal_strength",
                            "state_class": "measurement",
                            "entity_category": "diagnostic",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "rco2": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "unit_of_measurement": "ppm",
                            "device_class": "carbon_dioxide",
                            "state_class": "measurement",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "pm01": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "unit_of_measurement": "µg/m³",
                            "device_class": "pm1",
                            "state_class": "measurement",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "pm02": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "unit_of_measurement": "µg/m³",
                            "device_class": "pm25",
                            "state_class": "measurement",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "pm10": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "unit_of_measurement": "µg/m³",
                            "device_class": "pm10",
                            "state_class": "measurement",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "tvoc_index": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "name": "VOC Index",
                            "state_class": "measurement",
                            "icon": "mdi:air-filter",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "nox_index": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "name": "NOx Index",
                            "state_class": "measurement",
                            "icon": "mdi:air-filter",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "atmp": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "unit_of_measurement": "°C",
                            "device_class": "temperature",
                            "state_class": "measurement",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "rhum": {
                    this.client.publish(
                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "unit_of_measurement": "%",
                            "device_class": "humidity",
                            "state_class": "measurement",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "expire_after": 300,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }

                case "channels": {
                    Object.keys(payload["channels"]).forEach(channelKey => {
                        Object.keys(payload["channels"][channelKey]).forEach(key => {
                            switch (key) {
                                case "pm01": {
                                    this.client.publish(
                                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_channel_${channelKey}_${key}/config`,
                                        JSON.stringify({
                                            "state_topic": `${baseTopic}/channel_${channelKey}_${key}`,
                                            "unit_of_measurement": "µg/m³",
                                            "device_class": "pm1",
                                            "name": `CH${channelKey}: PM1`,
                                            "state_class": "measurement",
                                            "entity_category": "diagnostic",
                                            "object_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "unique_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "expire_after": 300,
                                            "device": device
                                        }),
                                        {retain: true}
                                    );

                                    break;
                                }
                                case "pm02": {
                                    this.client.publish(
                                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_channel_${channelKey}_${key}/config`,
                                        JSON.stringify({
                                            "state_topic": `${baseTopic}/channel_${channelKey}_${key}`,
                                            "unit_of_measurement": "µg/m³",
                                            "device_class": "pm25",
                                            "name": `CH${channelKey}: PM2.5`,
                                            "state_class": "measurement",
                                            "entity_category": "diagnostic",
                                            "object_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "unique_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "expire_after": 300,
                                            "device": device
                                        }),
                                        {retain: true}
                                    );

                                    break;
                                }
                                case "pm10": {
                                    this.client.publish(
                                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_channel_${channelKey}_${key}/config`,
                                        JSON.stringify({
                                            "state_topic": `${baseTopic}/channel_${channelKey}_${key}`,
                                            "unit_of_measurement": "µg/m³",
                                            "device_class": "pm10",
                                            "name": `CH${channelKey}: PM10`,
                                            "state_class": "measurement",
                                            "entity_category": "diagnostic",
                                            "object_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "unique_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "expire_after": 300,
                                            "device": device
                                        }),
                                        {retain: true}
                                    );

                                    break;
                                }
                                case "atmp": {
                                    this.client.publish(
                                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_channel_${channelKey}_${key}/config`,
                                        JSON.stringify({
                                            "state_topic": `${baseTopic}/channel_${channelKey}_${key}`,
                                            "unit_of_measurement": "°C",
                                            "device_class": "temperature",
                                            "name": `CH${channelKey}: Temperature`,
                                            "state_class": "measurement",
                                            "entity_category": "diagnostic",
                                            "object_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "unique_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "expire_after": 300,
                                            "device": device
                                        }),
                                        {retain: true}
                                    );

                                    break;
                                }
                                case "rhum": {
                                    this.client.publish(
                                        `homeassistant/sensor/airgradient2mqtt_${sensorId}/${sensorId}_channel_${channelKey}_${key}/config`,
                                        JSON.stringify({
                                            "state_topic": `${baseTopic}/channel_${channelKey}_${key}`,
                                            "unit_of_measurement": "%",
                                            "device_class": "humidity",
                                            "name": `CH${channelKey}: Humidity`,
                                            "state_class": "measurement",
                                            "entity_category": "diagnostic",
                                            "object_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "unique_id": `airgradient2mqtt_${sensorId}_channel_${channelKey}_${key}`,
                                            "expire_after": 300,
                                            "device": device
                                        }),
                                        {retain: true}
                                    );

                                    break;
                                }
                                case "pm003_count": {
                                    // ignored

                                    break;
                                }
                                default: {
                                    Logger.warn(`Received unknown channel payload key ${key}`);
                                }
                            }
                        });

                    });

                    break;
                }

                case "rgb_bri": { //Custom firmware feature
                    this.client.publish(
                        `homeassistant/number/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "command_topic": `${baseTopic}/${key}/set`,
                            "name": "RGB LED Brightness",
                            "icon": "mdi:brightness-5",
                            "min": 0,
                            "max": 255,
                            "mode": "slider",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }
                case "oled_bri": { //Custom firmware feature
                    this.client.publish(
                        `homeassistant/number/airgradient2mqtt_${sensorId}/${sensorId}_${key}/config`,
                        JSON.stringify({
                            "state_topic": `${baseTopic}/${key}`,
                            "command_topic": `${baseTopic}/${key}/set`,
                            "name": "OLED Display Brightness",
                            "icon": "mdi:brightness-5",
                            "min": 0,
                            "max": 255,
                            "mode": "slider",
                            "object_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "unique_id": `airgradient2mqtt_${sensorId}_${key}`,
                            "device": device
                        }),
                        {retain: true}
                    );

                    break;
                }

                case "pm003_count":
                case "boot": {
                    // ignored

                    break;
                }
                default: {
                    Logger.warn(`Received unknown payload key ${key}`);
                }
            }
        });



        this.client.publish( // Custom firmware feature
            `homeassistant/button/airgradient2mqtt_${sensorId}/${sensorId}_reboot/config`,
            JSON.stringify({
                "command_topic": `${baseTopic}/do_reboot/set`,
                "name": "Reboot",
                "icon": "mdi:restart",
                "entity_category": "diagnostic",
                "object_id": `airgradient2mqtt_${sensorId}_reboot`,
                "unique_id": `airgradient2mqtt_${sensorId}_reboot`,
                "device": device
            }),
            {retain: true}
        );
        this.client.publish( // Custom firmware feature
            `homeassistant/button/airgradient2mqtt_${sensorId}/${sensorId}_reset_wifi/config`,
            JSON.stringify({
                "command_topic": `${baseTopic}/do_reset_wifi/set`,
                "name": "Reset Wi-Fi Config",
                "icon": "mdi:restart-alert",
                "entity_category": "diagnostic",
                "object_id": `airgradient2mqtt_${sensorId}_reset_wifi`,
                "unique_id": `airgradient2mqtt_${sensorId}_reset_wifi`,
                "device": device
            }),
            {retain: true}
        );


        Logger.info(`Successfully published autoconf data for ${sensorId}`);

        this.autoconfTimestamps[sensorId] = Date.now();
    }
}

MqttClient.TOPIC_PREFIX = "airgradient2mqtt";

module.exports = MqttClient;
