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
// const client = require('./lib/fakeclient');

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
    const { host, port, use_password, userName, password } = params;
    const endpointUrl = `opc.tcp://${host}:${port}`;

    const connectionStrategy = {
      initialDelay: 1000,
      maxRetry: 3,
    };
    try {
      client = OPCUAClient.create({
        applicationName: "MyClient",
        connectionStrategy,
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false,
      });

      client.on("backoff", (retry, delay) => {
        plugin.log(
          `Backoff ", ${retry}, " next attempt in ", ${delay}, "ms"`,
          0
        );
        process.on("SIGTERM", () => {
          process.exit(0);
        });
      });

      client.on("connection_lost", () => {
        plugin.log("Connection lost", 0);
        process.on("SIGTERM", () => {
          process.exit(0);
        });
      });

      client.on("connection_reestablished", () => {
        plugin.log("Connection re-established", 0);
      });

      client.on("connection_failed", () => {
        plugin.log("Connection failed", 0);
      });
      client.on("start_reconnection", () => {
        plugin.log("Starting reconnection", 0);
      });

      client.on("after_reconnection", (err) => {
        plugin.log(`After Reconnection event =>", ${err}`, 0);
      });

      // step 1 : connect to
      await client.connect(endpointUrl);
      plugin.log("connected !", 0);

      // step 2 : createSession
      session = await client.createSession({
        userName: userName,
        password: password,
      });

      plugin.log("session created !", 0);
    } catch (err) {
      plugin.log("An error has occured : ", err);
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
            "subscription started - subscriptionId=",
            subscription.subscriptionId
          );
        })
        .on("keepalive", () => {
          plugin.log("keepalive");
        })
        .on("terminated", () => {
          plugin.log("terminated");
        });
    } catch (err) {
      plugin.log("An error has occured : ", err);
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
        let chanId =
          "ns=" +
          monitorItem.itemToMonitor.nodeId.namespace +
          ";s=" +
          monitorItem.itemToMonitor.nodeId.value;
        plugin.sendData([{ id: chanId, value: dataValue.value.value }]);
        //console.log(" value has changed : ", chanId, "  ", dataValue.value.value);
      });
    } catch (err) {
      plugin.log("An error has occured : ", err);
    }
  }

  async function write(data) {
    data.data.forEach((element) =>
      session.write(
        {
          nodeId: element.id,
          attributeId: AttributeIds.Value,
          value: {
            value: {
              dataType: DataType[element.dataType],
              value: element.value,
            },
          },
        },
        (err, statusCode) => {
          if (!err) {
            plugin.log("Write OK");
          } else {
            plugin.log(
              "Write ERROR: " + util.inspect(err) + " statusCode=" + statusCode
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
    process.exit(0);
  });
};

async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
