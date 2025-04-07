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
  StatusCodes,
  ClientSubscription,
  TimestampsToReturn,
  ClientMonitoredItemGroup,
  DataType,
  NodeId,
} = require("node-opcua");

const { OPCUACertificateManager } = require('node-opcua-certificate-manager');

const Scanner = require("./lib/scanner");

module.exports = async function (plugin) {
  let client;
  let session;
  let subscription;
  let monitoredItem;
  let monitoredItemArr = [];
  let toSend = [];
  let curChannels = {};
  let T1;
  let redundancy = 0;
  let status = "";

  const scanner = new Scanner(plugin);

  process.send({ type: 'procinfo', data: { redundancy_state: plugin.params.data.use_redundancy } });
  process.send({ type: 'procinfo', data: { current_endpoint: plugin.params.data.endpointUrl } });
  process.send({ type: 'procinfo', data: { current_server: redundancy } });
  plugin.onAct(async (data) => write(data));
  plugin.onCommand(async (data) => parseCommand(data));

  plugin.channels.onChange(async function (data) {
    monitoredItemArr.forEach(item => item.terminate())
    const channels = await plugin.channels.get();
    monitor(plugin.params.data, channels);
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
    const {
      endpointUrl,
      use_password,
      userName,
      password,
      securityPolicy,
      messageSecurityMode,
      initialDelay,
      maxRetry } = params;

    const connectionStrategy = {
      initialDelay: initialDelay || 1000,
      maxRetry: maxRetry || 3,
    };

    client = OPCUAClient.create({
      applicationName: "IntraClient",
      connectionStrategy,
      securityMode: MessageSecurityMode[messageSecurityMode],
      securityPolicy: SecurityPolicy[securityPolicy],
      endpointMustExist: false,
      clientCertificateManager: new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        untrustUnknownCertificate: false
      }),
    });

    client.on("backoff", async (retry, delay) => {
      plugin.log(
        `Backoff ", ${retry}, " next attempt in ", ${delay}, "ms"`,
        2
      );
      if (redundancy == 0 && plugin.params.data.use_redundancy == 1) {
        if (plugin.params.data.maxRetry - 1 == retry) {
          await client.disconnect();
          plugin.params.data.endpointUrl = plugin.params.data.redundancy_endpointUrl;
          redundancy = 1;
          process.send({ type: 'procinfo', data: { current_server: redundancy } });
          process.send({ type: 'procinfo', data: { current_endpoint: plugin.params.data.endpointUrl } });
          main(plugin.params.data);
        }
      } else {
        if (plugin.params.data.maxRetry - 1 == retry) {
          plugin.exit();
        }
      }
    });

    client.on("connection_lost", () => {
      plugin.log("connection_lost !", 2);
    });

    client.on("connection_reestablished", () => {
      plugin.log("Connection re-established", 2);
    });

    client.on("connection_failed", () => {
      plugin.log("Connection failed", 2);
    });
    client.on("start_reconnection", () => {
      plugin.log("Starting reconnection", 2);
    });

    client.on("after_reconnection", (err) => {
      plugin.log(`After Reconnection event =>", ${err}`, 2);
    });

    try {
      // step 1 : connect to

      await client.connect(endpointUrl);
      plugin.log("connected to " + endpointUrl, 2);

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
      plugin.log("session created !", 2);
      return 1;

    } catch (err) {
      plugin.log("An error has occured : " + util.inspect(err) + redundancy, 2);
      if (redundancy == 0 && plugin.params.data.use_redundancy == 1) {
        return 0;
      } else {
        plugin.exit();
      }

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
          plugin.log("terminated", 2);
        });
    } catch (err) {
      plugin.log("An error has occured : " + util.inspect(err), 2);
    }
  }

  function monitor(params, channels) {
    const groupChannels = groupByUniq(channels, 'parentnodefolder');
    curChannels = groupBy(channels, 'chan');
    let parameters = {};
    const { samplingInterval, discardOldest, queueSize, maxVariablesPerSub } = params;

    Object.keys(groupChannels).forEach(key => {
      const itemsToMonitor = [];
      groupChannels[key].ref.forEach((channel) => {
        itemsToMonitor.push({ nodeId: channel.chan, attributeId: AttributeIds.Value });
      });
      if (key == undefined) {
        parameters = {
          samplingInterval: samplingInterval || 100,
          discardOldest: discardOldest || true,
          queueSize: queueSize || 10,
          maxVariablesPerSub: maxVariablesPerSub || 100
        };
      } else {
        parameters = {
          samplingInterval: groupChannels[key].ref[0].parentsamplingInterval || 100,
          discardOldest: groupChannels[key].ref[0].parentdiscardOldest || true,
          queueSize: groupChannels[key].ref[0].parentqueueSize || 10,
          maxVariablesPerSub: maxVariablesPerSub || 100
        };
      }

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
    })
    try {
      for (let i = 0; i < monitoredItemArr.length; i++) {
        monitoredItemArr[i].on('err', (monitorItem, dataValue) => {
          plugin.log("monitorItem " + monitorItem + " dataValue " + dataValue, 2);
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
          } else if (typeof dataValue.value.value == "boolean") {
            value = dataValue.value.value == true ? 1 : 0;
          } else {
            value = dataValue.value.value;
          }
          curChannels[chanId].ref.forEach(item => {
            toSend.push({ id: item.id, value: value, chstatus: dataValue.statusCode._value, ts: ts });
          })
          //plugin.sendData([{ id: chanId, value: dataValue.value.value, chstatus: dataValue.statusCode._value }]);
        });
      }

    } catch (err) {
      plugin.log("An error has occured : " + util.inspect(err), 2);
    }
  }

  async function write(data) {
    plugin.log(util.inspect(data), 2);
    let nodeArr = [];
    for (let i = 0; i < data.data.length; i++) {
      const element = data.data[i];
      if (element.dataType == 'Method') {
        const methodToCall = {
          objectId: element.objectId,
          methodId: element.chan
        }
        session.call(methodToCall, function (err, results) {
          if (!err) {
            plugin.log("Call Method OK", 2);
          } else {
            plugin.log(
              "Call Method ERROR: " + util.inspect(err) + " statusCode=" + results, 2
            );
          }
        });
      } else {
        let nodeType;
        if (element.dataType.includes("ns")) {
          const nodeId = NodeId.resolveNodeId(element.chan);
          try {
            nodeType = await session.getBuiltInDataType(nodeId);
          } catch (e) {
            plugin.log("Get dataType ERROR " + e, 2);
          }
        } else {
          nodeType = DataType[element.dataType];
        }
        let value;
        if ((element.dataType == 'Boolean') || (element.dataType == 'Bool')) {
          value = element.value == 0 ? false : true;
        } else {
          value = String(element.value)
        }
        nodeArr.push({
          nodeId: element.chan,
          attributeId: AttributeIds.Value,
          value: {
            value: {
              dataType: nodeType,
              value: value,
            },            
          },
          itemId: element.id,
          wresult: element.wresult
        })

      }
    };
    if (nodeArr.length > 0) {
      session.write(
        nodeArr,
        (err, statusCode) => {
          if (!err) {
            plugin.log("Write OK statusCode=" + statusCode, 2);
            //if (statusCode == StatusCodes.Good) {
              const sendArr = [];
              nodeArr.forEach(item => {
                if (item.wresult) {
                  sendArr.push({ id: item.itemId, value: item.value.value.value, chstatus: 0, ts: Date.now() })
                }
              })
              if (sendArr.length > 0) plugin.sendData(sendArr);
            //}
          } else {
            plugin.log(
              "Write ERROR: " + util.inspect(err) + " statusCode=" + statusCode, 2
            );
          }
        }
      )
    }
  }

  async function parseCommand(message) {
    plugin.log(`Command '${message.command}' received. Data: ${util.inspect(message)}`, 2);
    let payload = {};
    try {
      if (message.command == 'syncHistory') {
        const nodesObj = {};
        const nodes = [];
        message.data.chanarr.forEach(item => {
          nodesObj[item.chan] = item.id;
          nodes.push(item.chan)
        })

        const startTime = new Date(message.data.startTime).toISOString();
        const endTime = new Date(message.data.endTime).toISOString();
        const result = await session.readHistoryValue(nodes, startTime, endTime);
        nodes.forEach((node, index) => {
          const data = [];
          result[index].historyData.dataValues.forEach(item => {
            const date = new Date(item.sourceTimestamp);
            data.push({ id: nodesObj[node], value: item.value.value, ts: date.getTime() })
          })
          plugin.sendArchive(data);
        })
        plugin.sendResponse(Object.assign({ payload }, message), 1);
      }
    } catch (e) {
      this.plugin.sendResponse(Object.assign({ payload: e }, message), 0);
    }
  }

  function groupBy(objectArray, property) {
    return objectArray.reduce((acc, obj) => {
      let key = obj[property];
      if (!acc[key]) {
        acc[key] = {};
        acc[key].ref = [];
      }
      acc[key].ref.push(obj);
      return acc;
    }, {});
  }

  function groupByUniq(objectArray, property) {
    const uniq = {};
    return objectArray.reduce((acc, obj) => {
      let key = obj[property];
      if (!acc[key]) {
        acc[key] = {};
        acc[key].ref = [];
      }
      if (uniq[obj.chan] == undefined) {
        uniq[obj.chan] = obj;
        acc[key].ref.push(obj);
      }

      return acc;
    }, {});
  }

  async function main(connectionParams) {
    const status = await connect(connectionParams);
    if (status) {
      subscribe(plugin.params.data);
      monitor(plugin.params.data, plugin.channels.data);
    }

  }

  main(plugin.params.data);

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

  plugin.onScanexpand((scanObj) => {
    scanner.scanExpand(scanObj);
  });  

  process.on("SIGTERM", async () => {
    await terminate();
    plugin.exit();
  });

  if (plugin.onStop) {
    plugin.onStop(async () => {
      await terminate();
    });
  }
  
  async function terminate() {
    if (!client.isReconnecting) {
      await client.disconnect();
      plugin.log('Client disconnected');
    }
  }
};

async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}