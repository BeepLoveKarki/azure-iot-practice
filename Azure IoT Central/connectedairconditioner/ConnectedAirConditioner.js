'use strict';

let clientFromConnectionString = require('azure-iot-device-mqtt').clientFromConnectionString;
let Message = require('azure-iot-device').Message;
let ConnectionString = require('azure-iot-device').ConnectionString;

let connectionString = 'HostName=iotc-4b9ae480-4555-400b-9013-733ba0dd0a87.azure-devices.net;DeviceId=8ee3f238-1199-4ceb-b186-d988ad74db52;SharedAccessKey=5pOGFXsgne27oQSiW3D+W96uVlxC7Atk8dNF0Vdn4sc=';
let targetTemperature = 0;
let client = clientFromConnectionString(connectionString);

// Send device telemetry.
function sendTelemetry() {
  let temperature = targetTemperature + (Math.random() * 15);
  let data = JSON.stringify({ temperature: temperature });
  let message = new Message(data);
  client.sendEvent(message, (err, res) => console.log(`Sent message: ${message.getData()}` +
    (err ? `; error: ${err.toString()}` : '') +
    (res ? `; status: ${res.constructor.name}` : '')));
}

function sendDeviceProperties(twin) {
  let properties = {
    firmwareVersion: "9.75",
    serialNumber: "10001"
  };
  twin.properties.reported.update(properties, (errorMessage) => 
  console.log(` * Sent device properties ` + (errorMessage ? `Error: ${errorMessage.toString()}` : `(success)`)));
}

// Add any settings your device supports
// mapped to a function that is called when the setting is changed.
let settings = {
  'setTemperature': (newValue, callback) => {
    // Simulate the temperature setting taking two steps.
    setTimeout(() => {
      targetTemperature = targetTemperature + (newValue - targetTemperature) / 2;
      callback(targetTemperature, 'pending');
      setTimeout(() => {
        targetTemperature = newValue;
        callback(targetTemperature, 'completed');
      }, 5000);
    }, 5000);
  }
};

// Handle settings changes that come from Azure IoT Central via the device twin.
function handleSettings(twin) {
  twin.on('properties.desired', function (desiredChange) {
    for (let setting in desiredChange) {
      if (settings[setting]) {
        console.log(`Received setting: ${setting}: ${desiredChange[setting].value}`);
        settings[setting](desiredChange[setting].value, (newValue, status, message) => {
          let patch = {
            [setting]: {
              value: newValue,
              status: status,
              desiredVersion: desiredChange.$version,
              message: message
            }
          }
          twin.properties.reported.update(patch, (err) => console.log(`Sent setting update for ${setting}; ` +
            (err ? `error: ${err.toString()}` : `status: success`)));
        });
      }
    }
  });
}

// Respond to the echo command
function onCommandEcho(request, response) {
  // Display console info
  console.log(' * Echo command received');
  // Respond
  response.send(10, 'Success', function (errorMessage) {});
}


// Handle device connection to Azure IoT Central.
let connectCallback = (err) => {
  if (err) {
    console.log(`Device could not connect to Azure IoT Central: ${err.toString()}`);
  } else {
    console.log('Device successfully connected to Azure IoT Central');
    // Send telemetry measurements to Azure IoT Central every 1 second.
    setInterval(sendTelemetry, 1000);
    // Setup device command callbacks
    client.onDeviceMethod('echo', onCommandEcho);
    // Get device twin from Azure IoT Central.
    client.getTwin((err, twin) => {
      if (err) {
        console.log(`Error getting device twin: ${err.toString()}`);
      } else {
        // Send device properties once on device start up
        sendDeviceProperties(twin);
        // Apply device settings and handle changes to device settings.
        handleSettings(twin);
      }
    });
  }
};

client.open(connectCallback);