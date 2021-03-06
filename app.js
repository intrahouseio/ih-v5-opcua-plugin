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

  const scanner = new Scanner(plugin);
  //plugin.onCommnad(async data => parseCommand(data))
  plugin.onAct(async (data) => write(data));
  plugin.channels.onChange(async function () {
    monitoredItem.terminate();
    const channels = await plugin.channels.get();
    monitor(channels);
  });

  async function connect(params) {
    const { endpointUrl, use_password, userName, password, securityPolicy, messageSecurityMode } = params;

    const connectionStrategy = {
      initialDelay: 1000,
      maxRetry: 3,
    };
    try {
      client = OPCUAClient.create({
        applicationName: "IHClient",
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

  async function subscribe() {
    try {
      subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10,
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
      plugin.log("An error has occured : "+ util.inspect(err));
    }
  }

  async function monitor(channels) {
    const itemsToMonitor = channels.map((channel) => {
      return { nodeId: channel.id, attributeId: AttributeIds.Value };
    });

    const parameters = {
      samplingInterval: 100,
      discardOldest: true,
      queueSize: 10,
    };
    try {
      monitoredItem = ClientMonitoredItemGroup.create(
        subscription,
        itemsToMonitor,
        parameters,
        TimestampsToReturn.Both
      );

      monitoredItem.on("changed", (monitorItem, dataValue) => {
        let identifierString;
        switch (monitorItem.itemToMonitor.nodeId.identifierType) {
          case 1: identifierString = ';i='; break;
          case 2: identifierString = ';s='; break;
          case 3: identifierString = ';g='; break;
          case 4: identifierString = ';b='; break;
          default: identifierString = String(monitorItem.itemToMonitor.nodeId.identifierType); break;
        }
        let chanId
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
        //plugin.log("Statuscode" + util.inspect(dataValue.statusCode._value));
        plugin.sendData([{ id: chanId, value: dataValue.value.value, chstatus: dataValue.statusCode._value }]);
      });
    } catch (err) {
      plugin.log("An error has occured : "+ util.inspect(err));
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
              value: element.dataType == ('Boolean' || 'Bool') ? element.value == 0 ? false : true : element.value,
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
    await subscribe();
    await monitor(plugin.channels.data);
  }

  main();

  // --- ?????????????? ?????????????? ---
  // ????????????????????????
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
