# Airgradient2mqtt

This is a small Node.js service that mocks the airgradient cloud and publishes all the data to an MQTT broker.
It also takes care of Home Assistant autodiscovery leading to things just working.

Furthermore, in conjunction with the firmware modifications found in this repo, it also provides the ability to send
commands to the sensors.

![hass_demo.png](../img/hass_demo.png)

## Usage

The dummycloud is configured using environment variables to be container-friendly to use.

- `LOGLEVEL` (defaults to `info`)
- `CLOUD_PORT` (defaults to `80`)
- `MQTT_BROKER_URL` (no default. Should look like `mqtt://foo.bar`)
- `MQTT_USERNAME` (no default, optional.)
- `MQTT_PASSWORD` (no default, optional.)
- `MQTT_CHECK_CERT` set to `false` for using `mqtts` with self-signed certificate (defaults to `true`)

## Network setup

To point your sensors at this, you'll have to either modify their firmware and change `APIROOT` or modify your network's
internal DNS to resolve `hw.airgradient.com` and for the custom FW `airgradient.internal` to wherever your cloud replacement host is.

e.g.

```
~$ cat /etc/dnsmasq.d/airgradient.conf

address=/hw.airgradient.com/192.168.178.5
address=/airgradient.internal/192.168.178.5
```

## Deployment

The dummycloud can be started using `npm run start`. Next to this readme, there's also a dockerfile provided.

A `docker-compose.yml` entry could for example look like this:

```yml
  airgradient2mqtt:
    build:
      context: ./airgradient-cloud-free/airgradient2mqtt/
      dockerfile: Dockerfile
    container_name: "airgradient2mqtt"
    restart: always
    environment:
      - "LOGLEVEL=info"
      - "MQTT_BROKER_URL=mqtt://foobar.example"
      # User those variables if the MQTT broker requires username and password
      # - "MQTT_USERNAME=example-user"
      # - "MQTT_PASSWORD=example-password"
    ports:
      - "80:80" # Or change using the CLOUD_PORT env variable and put some reverse proxy in front of it
```
