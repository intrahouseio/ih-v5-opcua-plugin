/**
 * app.js
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
  let monitoredItemArr = [];
  let toSend = [];
  let curChannels = {};
  let T1;
  let redundancy = 0;
  let lastKeepAlive = Date.now();
  let keepAliveTimeout;
  let primaryCheckInterval;
  let isSwitching = false;

  const scanner = new Scanner(plugin);

  process.send({ type: 'procinfo', data: { redundancy_state: plugin.params.data.use_redundancy } });
  process.send({ type: 'procinfo', data: { current_endpoint: plugin.params.data.endpointUrl } });
  process.send({ type: 'procinfo', data: { current_server: redundancy } });
  plugin.onAct(async (data) => write(data));
  plugin.onCommand(async (data) => parseCommand(data));

  plugin.channels.onChange(async function (data) {
    monitoredItemArr.forEach(item => item.terminate());
    const channels = await plugin.channels.get();
    monitor(plugin.params.data, channels);
  });
  const { buffertime, use_system_ts } = plugin.params.data;
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
      initialDelay = 1000,
      maxRetry = 3,
      keepAliveTimeoutThreshold = 15000,
      primaryCheckIntervalMs = 60000,
      use_redundancy = 0
    } = params;

    const connectionStrategy = {
      initialDelay,
      maxRetry,
      transportTimeout: 5000
    };

    if (!client) {
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
        plugin.log(`Backoff on ${redundancy == 0 ? 'primary' : 'redundant'} server, retry ${retry}, next attempt in ${delay}ms`, 2);
        if (retry >= maxRetry - 1) {
          plugin.log(`Max retries (${maxRetry}) exceeded on ${redundancy == 0 ? 'primary' : 'redundant'} server`, 2);
          await client.disconnect();
          plugin.log(`Disconnected from ${redundancy == 0 ? 'primary' : 'redundant'} server`, 2);
          if (redundancy == 0 && use_redundancy == 1) {
            plugin.log(`Initiating switch to redundant server`, 2);
            isSwitching = true;
            await switchToRedundant(primaryCheckIntervalMs);
          } else {
            plugin.log(`No further redundancy available, exiting`, 2);
            plugin.exit();
          }
        }
      });

      client.on("connection_lost", async () => {
        plugin.log("Connection lost!", 2);
        if (redundancy == 0 && plugin.params.data.use_redundancy == 1 && !isSwitching) {
          plugin.log(`Connection lost on primary server, switching to redundant`, 2);
          isSwitching = true;
          await client.disconnect();
          await switchToRedundant(plugin.params.data.primaryCheckIntervalMs || 60000);
        }
      });

      client.on("connection_reestablished", () => {
        plugin.log("Connection re-established", 2);
      });
    }

    try {
      plugin.log(`Attempting to connect to ${endpointUrl}`, 2);
      await client.connect(endpointUrl);
      plugin.log(`Connected to ${endpointUrl}`, 2);

      if (use_password) {
        session = await client.createSession({ userName, password });
      } else {
        session = await client.createSession();
      }
      plugin.log("Session created!", 2);

      lastKeepAlive = Date.now();
      startKeepAliveCheck(keepAliveTimeoutThreshold);
      return 1;
    } catch (err) {
      plugin.log(`Error occurred during connect: ${util.inspect(err)} (redundancy: ${redundancy})`, 2);
      await client.disconnect();
      return 0;
    }
  }

  function subscribe(params) {
    const {
      requestedPublishingInterval = 1000,
      requestedLifetimeCount = 100,
      requestedMaxKeepAliveCount = 10,
      maxNotificationsPerPublish = 100,
      priority = 10
    } = params;

    try {
      subscription = ClientSubscription.create(session, {
        requestedPublishingInterval,
        requestedLifetimeCount,
        requestedMaxKeepAliveCount,
        maxNotificationsPerPublish,
        publishingEnabled: true,
        priority,
      });

      subscription
        .on("started", () => {
          plugin.log(`Subscription started - subscriptionId=${subscription.subscriptionId}`, 1);
        })
        .on("keepalive", () => {
          plugin.log("Keepalive received", 2);
          lastKeepAlive = Date.now();
        })
        .on("terminated", () => {
          plugin.log("Subscription terminated", 2);
        });
    } catch (err) {
      plugin.log(`Subscription error: ${util.inspect(err)}`, 2);
    }
  }

  function startKeepAliveCheck(timeoutThreshold) {
    clearInterval(keepAliveTimeout);
    keepAliveTimeout = setInterval(() => {
      const timeSinceLastKeepAlive = Date.now() - lastKeepAlive;
      const maxAllowed = (plugin.params.data.requestedMaxKeepAliveCount || 10) * (plugin.params.data.requestedPublishingInterval || 1000) * 1.5;
      if (timeSinceLastKeepAlive > Math.max(timeoutThreshold, maxAllowed)) {
        plugin.log(`No keepalive for ${timeSinceLastKeepAlive}ms, exceeding threshold ${Math.max(timeoutThreshold, maxAllowed)}ms`, 2);
        handleKeepAliveTimeout();
      }
    }, 5000);
  }

  async function handleKeepAliveTimeout() {
    if (isSwitching) return;
    plugin.log(`Keepalive timeout detected on ${redundancy == 0 ? 'primary' : 'redundant'} server`, 2);
    if (redundancy == 0 && plugin.params.data.use_redundancy == 1) {
      isSwitching = true;
      clearInterval(keepAliveTimeout);
      await client.disconnect();
      plugin.log("Disconnected due to keepalive timeout", 2);
      const switchSuccess = await switchToRedundant(plugin.params.data.primaryCheckIntervalMs || 60000);
      if (!switchSuccess) {
        plugin.log("Failed to connect to redundant server after keepalive timeout, exiting", 2);
        plugin.exit();
      }
    } else {
      plugin.log(`Keepalive timeout on ${redundancy == 0 ? 'primary' : 'redundant'} server, continuing operation`, 2);
      lastKeepAlive = Date.now();
    }
  }

  async function switchToRedundant(primaryCheckIntervalMs) {
    if (!isSwitching) return false;
    plugin.params.data.endpointUrl = plugin.params.data.redundancy_endpointUrl;
    redundancy = 1;
    process.send({ type: 'procinfo', data: { current_server: redundancy } });
    process.send({ type: 'procinfo', data: { current_endpoint: plugin.params.data.endpointUrl } });
    plugin.log("Switching to redundant server", 2);
    const status = await main(plugin.params.data);
    if (status) {
      startPrimaryServerCheck(primaryCheckIntervalMs);
      isSwitching = false;
      return true;
    } else {
      isSwitching = false;
      return false;
    }
  }

  async function switchToPrimary() {
    if (isSwitching) return;
    isSwitching = true;
    await client.disconnect();
    plugin.log("Disconnected from redundant server", 2);
    plugin.params.data.endpointUrl = plugin.params.data.primary_endpointUrl;
    redundancy = 0;
    process.send({ type: 'procinfo', data: { current_server: redundancy } });
    process.send({ type: 'procinfo', data: { current_endpoint: plugin.params.data.endpointUrl } });
    plugin.log("Switching back to primary server", 2);
    await main(plugin.params.data);
    isSwitching = false;
  }

  function startPrimaryServerCheck(intervalMs) {
    clearInterval(primaryCheckInterval);
    primaryCheckInterval = setInterval(async () => {
      if (redundancy === 1 && !isSwitching) {
        try {
          const testClient = OPCUAClient.create({
            applicationName: "IntraClientTest",
            endpointMustExist: false,
            clientCertificateManager: new OPCUACertificateManager({
              automaticallyAcceptUnknownCertificate: true,
              untrustUnknownCertificate: false
            }),
          });
          await testClient.connect(plugin.params.data.primary_endpointUrl);
          plugin.log("Primary server is available, initiating switch back", 2);
          await testClient.disconnect();
          clearInterval(primaryCheckInterval);
          await switchToPrimary();
        } catch (err) {
          plugin.log(`Primary server still unavailable: ${util.inspect(err)}`, 2);
        }
      }
    }, intervalMs || 60000);
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
        const monitoredItem = ClientMonitoredItemGroup.create(
          subscription,
          chunk,
          parameters,
          TimestampsToReturn.Both
        );
        monitoredItemArr.push(monitoredItem);
      }
    });

    try {
      for (let i = 0; i < monitoredItemArr.length; i++) {
        monitoredItemArr[i].on('err', (monitorItem, dataValue) => {
          plugin.log(`monitorItem ${monitorItem} dataValue ${dataValue}`, 2);
        });
        monitoredItemArr[i].on("changed", (monitorItem, dataValue) => {
          lastKeepAlive = Date.now();
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
          if (typeof dataValue.value.value === 'object') {
            value = JSON.stringify(dataValue.value.value);
          } else if (typeof dataValue.value.value == "boolean") {
            value = dataValue.value.value == true ? 1 : 0;
          } else {
            value = dataValue.value.value;
          }
          curChannels[chanId].ref.forEach(item => {
            if (item.dataType.toUpperCase() == 'INT64' || item.dataType.toUpperCase() == 'LINT') {
              value = wordsToBigInt(dataValue.value.value, 'INT64')
            }
            if (item.dataType.toUpperCase() == 'UINT64' || item.dataType.toUpperCase() == 'LWORD') {
              value = wordsToBigInt(dataValue.value.value, 'UINT64')
            }
            toSend.push({ id: item.id, value: value, quality: dataValue.statusCode._value, ts: use_system_ts ? Date.now() : ts });
          });
        });
      }
    } catch (err) {
      plugin.log(`Monitor error: ${util.inspect(err)}`, 2);
    }

    function wordsToBigInt(arr, type) {
      if (!Array.isArray(arr) || arr.length !== 2) {
        plugin.log("Expected array of 2 elements ");
        return;
      }
      const lo = arr[1] >>> 0; 
      const hi = arr[0] >>> 0;

      const buf = Buffer.alloc(8);
      buf.writeUInt32LE(lo, 0);
      buf.writeUInt32LE(hi, 4);
      if (type.toUpperCase() == 'INT64') return String(buf.readBigInt64LE(0));
      if (type.toUpperCase() == 'UINT64') return String(buf.readBigUint64LE(0));
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
        };
        session.call(methodToCall, function (err, results) {
          if (!err) {
            plugin.log("Call Method OK", 2);
          } else {
            plugin.log(`Call Method ERROR: ${util.inspect(err)} statusCode=${results}`, 2);
          }
        });
      } else {
        let nodeType;
        if (element.dataType.includes("ns")) {
          const nodeId = NodeId.resolveNodeId(element.chan);
          try {
            nodeType = await session.getBuiltInDataType(nodeId);
          } catch (e) {
            plugin.log(`Get dataType ERROR ${e}`, 2);
          }
        } else {
          nodeType = DataType[element.dataType];
        }
        let value;
        if ((element.dataType == 'Boolean') || (element.dataType == 'Bool')) {
          value = element.value == 0 ? false : true;
        } else {
          value = String(element.value);
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
        });
      }
    }
    if (nodeArr.length > 0) {
      session.write(nodeArr, (err, statusCode) => {
        if (!err) {
          plugin.log(`Write OK statusCode=${statusCode}`, 2);
          const sendArr = [];
          nodeArr.forEach(item => {
            if (item.wresult) {
              sendArr.push({ id: item.itemId, value: item.value.value.value, quality: 0, ts: Date.now() });
            }
          });
          if (sendArr.length > 0) plugin.sendData(sendArr);
        } else {
          plugin.log(`Write ERROR: ${util.inspect(err)} statusCode=${statusCode}`, 2);
        }
      });
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
          nodes.push(item.chan);
        });

        const startTime = new Date(message.data.startTime).toISOString();
        const endTime = new Date(message.data.endTime).toISOString();
        const result = await session.readHistoryValue(nodes, startTime, endTime);
        nodes.forEach((node, index) => {
          const data = [];
          result[index].historyData.dataValues.forEach(item => {
            const date = new Date(item.sourceTimestamp);
            data.push({ id: nodesObj[node], value: item.value.value, ts: date.getTime() });
          });
          plugin.sendArchive(data);
        });
        plugin.sendResponse(Object.assign({ payload }, message), 1);
      }
    } catch (e) {
      plugin.sendResponse(Object.assign({ payload: e }, message), 0);
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
    if (!connectionParams.primary_endpointUrl) {
      connectionParams.primary_endpointUrl = connectionParams.endpointUrl;
    }
    const status = await connect(connectionParams);
    if (status) {
      subscribe(plugin.params.data);
      monitor(plugin.params.data, plugin.channels.data);
    }
    return status; // Возвращаем статус подключения
  }

  main(plugin.params.data);

  plugin.onScan((scanObj) => {
    if (!scanObj) return;
    if (scanObj.stop) {
      //
    } else {
      scanner.request(session, scanObj.uuid);
    }
  });

  if (plugin.onScanexpand) plugin.onScanexpand((scanObj) => {
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
    clearInterval(keepAliveTimeout);
    clearInterval(primaryCheckInterval);
    await client.disconnect();
    plugin.log('Client disconnected');
  }
};



async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}