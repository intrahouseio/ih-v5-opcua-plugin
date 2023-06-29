/**
 * app.js
 *
 */

const util = require("util");

const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  ClientSubscription,
  TimestampsToReturn,
  ClientMonitoredItemGroup,
  DataType,
} = require("node-opcua");

const Scanner = require("./lib/scanner");

module.exports = async function (plugin) {
  let client;
  let session;
  let subscription;
  let monitoredItem;
  let monitoredItemArr = [];
  let toSend = [];
  let T1;

  const scanner = new Scanner(plugin);
  //plugin.onCommnad(async data => parseCommand(data))
  plugin.onAct(async (data) => write(data));
  plugin.channels.onChange(async function () {
    monitoredItemArr.forEach(item => item.terminate())
    //monitoredItem.terminate();
    const channels = await plugin.channels.get();
    monitor(channels);
  });
  const { buffertime } = plugin.params.data;
  sendNext();


  function sendNext() {

    if (toSend.length > 0) {
      plugin.sendData(toSend);
      toSend = [];
    }
    T1 = setTimeout(sendNext, buffertime || 500);
  }

  async function connect(params) {
    const { endpointUrl, use_password, userName, password, securityPolicy, messageSecurityMode } = params;

    const connectionStrategy = {
      initialDelay: 1000,
      maxRetry: 3,
    };
    try {
      client = OPCUAClient.create({
        applicationName: "IntraClient",
        connectionStrategy,
        securityMode: MessageSecurityMode[messageSecurityMode],
        securityPolicy: SecurityPolicy[securityPolicy],
        endpointMustExist: false
      });

      client.on("backoff", (retry, delay) => {
        plugin.log(
          `Backoff ", ${retry}, " next attempt in ", ${delay}, "ms"`,
          2
        );
        plugin.exit();
      });

      client.on("connection_lost", () => {
        plugin.exit();
      });

      client.on("connection_reestablished", () => {
        plugin.log("Connection re-established", 0);
      });

      client.on("connection_failed", () => {
        plugin.log("Connection failed", 0);
      });
      client.on("start_reconnection", () => {
        plugin.log("Starting reconnection", 1);
      });

      client.on("after_reconnection", (err) => {
        plugin.log(`After Reconnection event =>", ${err}`, 0);
      });

      // step 1 : connect to
      await client.connect(endpointUrl);
      plugin.log("connected !", 0);

      // step 2 : createSession
      /**/
      if (use_password) {
        session = await client.createSession({
          userName: userName,
          password: password,
        });
      } else {
        session = await client.createSession({
        });
      }
      plugin.log("session created !", 0);

    } catch (err) {
      plugin.log("An error has occured : " + util.inspect(err));
      plugin.exit();
    }
  }

  function subscribe(params) {
    const { requestedPublishingInterval, requestedLifetimeCount, requestedMaxKeepAliveCount, maxNotificationsPerPublish, priority } = params;
    try {
      subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: requestedPublishingInterval || 1000,
        requestedLifetimeCount: requestedLifetimeCount || 100,
        requestedMaxKeepAliveCount: requestedMaxKeepAliveCount || 10,
        maxNotificationsPerPublish: maxNotificationsPerPublish || 100,
        publishingEnabled: true,
        priority: priority || 10,
      });

      subscription
        .on("started", () => {
          plugin.log(
            "subscription started - subscriptionId=" +
            subscription.subscriptionId, 1
          );
        })
        .on("keepalive", () => {
          plugin.log("keepalive", 2);
        })
        .on("terminated", () => {
          plugin.log("terminated", 0);
        });
    } catch (err) {
      plugin.log("An error has occured : " + util.inspect(err));
    }
  }

  function monitor(params, channels) {
    const { samplingInterval, discardOldest, queueSize, maxVariablesPerSub } = params;

    const itemsToMonitor = channels.map((channel) => {
      return { nodeId: channel.id, attributeId: AttributeIds.Value };
    });

    const parameters = {
      samplingInterval: samplingInterval || 100,
      discardOldest: discardOldest || true,
      queueSize: queueSize || 10,
      maxVariablesPerSub: maxVariablesPerSub || 100
    };

    while (itemsToMonitor.length > 0) {
      let chunk = itemsToMonitor.splice(0, parameters.maxVariablesPerSub);
      monitoredItem = ClientMonitoredItemGroup.create(
        subscription,
        chunk,
        parameters,
        TimestampsToReturn.Both
      );
      monitoredItemArr.push(monitoredItem);
    }


    try {


      for (let i = 0; i < monitoredItemArr.length; i++) {
        monitoredItemArr[i].on('err', (monitorItem, dataValue) => {
          plugin.log("monitorItem " + monitorItem + " dataValue " + dataValue);
        })
        monitoredItemArr[i].on("changed", (monitorItem, dataValue) => {
          let identifierString;
          switch (monitorItem.itemToMonitor.nodeId.identifierType) {
            case 1: identifierString = ';i='; break;
            case 2: identifierString = ';s='; break;
            case 3: identifierString = ';g='; break;
            case 4: identifierString = ';b='; break;
            default: identifierString = String(monitorItem.itemToMonitor.nodeId.identifierType); break;
          }
          let chanId;
          let ts;
          let value;
          if (identifierString == ';b=') {
            chanId = "ns=" +
              monitorItem.itemToMonitor.nodeId.namespace +
              identifierString +
              monitorItem.itemToMonitor.nodeId.value.toString('base64');
          } else {
            chanId = "ns=" +
              monitorItem.itemToMonitor.nodeId.namespace +
              identifierString +
              monitorItem.itemToMonitor.nodeId.value;
          }
          ts = new Date(dataValue.sourceTimestamp).getTime();
          //plugin.log("Statuscode" + util.inspect(dataValue));
          if (typeof dataValue.value.value === 'object') {
            value = JSON.stringify(dataValue.value.value);
          } else if (typeof dataValue.value.value == "boolean")  {
            value = dataValue.value.value == true ? 1 : 0;
          } else {
            value = dataValue.value.value;
          }
          toSend.push({ id: chanId, value: value, chstatus: dataValue.statusCode._value, ts: ts });
          //plugin.sendData([{ id: chanId, value: dataValue.value.value, chstatus: dataValue.statusCode._value }]);
        });
      }

    } catch (err) {
      plugin.log("An error has occured : " + util.inspect(err));
    }
  }

  async function write(data) {
    plugin.log(util.inspect(data));
    data.data.forEach((element) =>
      session.write(
        {
          nodeId: element.id,
          attributeId: AttributeIds.Value,
          value: {
            value: {
              dataType: DataType[element.dataType],
              value: (element.dataType == 'Boolean') || (element.dataType == 'Bool') ? element.value == 0 ? false : true : element.value,
            },
          },
        },
        (err, statusCode) => {
          if (!err) {
            plugin.log("Write OK");
          } else {
            plugin.log(
              "Write ERROR: " + util.inspect(err) + " statusCode=" + statusCode, 0
            );
          }
        }
      )
    );
  }
  async function main() {
    await connect(plugin.params.data);
    subscribe(plugin.params.data);
    monitor(plugin.params.data, plugin.channels.data);
  }

  main();

  // --- События плагина ---
  // Сканирование
  plugin.onScan((scanObj) => {
    if (!scanObj) return;
    if (scanObj.stop) {
      //
    } else {
      scanner.request(session, scanObj.uuid);
    }
  });

  process.on("SIGTERM", () => {
    plugin.exit();
  });
};

async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}