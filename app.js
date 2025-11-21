/**
 * app.js
 */

const util = require("util");
const {
  AttributeIds,
  ClientSubscription,
  TimestampsToReturn,
  ClientMonitoredItemGroup,
  DataChangeFilter,
  DataType,
  NodeId,
} = require("node-opcua");

const Scanner = require("./lib/scanner");
const ConnectionManager = require("./lib/connectionManager");

module.exports = async function (plugin) {
  let subscriptions = [];
  let monitoredItemArr = [];
  let toSend = [];
  let curChannels = {};
  let T1;

  const { buffertime, use_system_ts } = plugin.params.data;
  const connectionManager = new ConnectionManager(plugin);
  const scanner = new Scanner(plugin);

  // Инициализация connection manager callbacks
  connectionManager.setOnRedundancySwitch(async (reason) => {
    const switchSuccess = await connectionManager.switchToRedundant(
      plugin.params.data,
      plugin.params.data.primaryCheckIntervalMs || 60000
    );
    if (!switchSuccess && reason === 'keepalive_timeout') {
      plugin.exit();
    }
    return switchSuccess;
  });

  connectionManager.setOnConnectionLost((reason) => {
    if (reason === 'no_redundancy' || reason === 'redundant_failed') {
      plugin.exit();
    }
  });

  connectionManager.setOnConnectionRestored(() => {
    // Можно добавить логику при восстановлении соединения
  });
  connectionManager._sendProcInfo();
  // Инициализация плагина
  process.send({ type: 'procinfo', data: { redundancy_state: plugin.params.data.use_redundancy } });
  process.send({ type: 'procinfo', data: { current_endpoint: plugin.params.data.endpointUrl } });
  process.send({ type: 'procinfo', data: { current_server: connectionManager.getRedundancyState() } });

  plugin.onAct(async (data) => write(data));
  plugin.onCommand(async (data) => parseCommand(data));

  plugin.channels.onChange(async function (data) {
    //monitoredItemArr.forEach(item => item.terminate());
    subscriptions.forEach(sub => sub.terminate());
    subscriptions = [];
    const channels = await plugin.channels.get();
    monitor(plugin.params.data, channels);
  });

  sendNext();

  function sendNext() {
    if (toSend.length > 0) {
      plugin.sendData(toSend);
      toSend = [];
    }
    T1 = setTimeout(sendNext, buffertime || 500);
  }

  function subscribe(params, subscriptionId = null) {
    const {
      requestedPublishingInterval = 1000,
      requestedLifetimeCount = 100,
      requestedMaxKeepAliveCount = 10,
      maxNotificationsPerPublish = 100,
      priority = 10
    } = params;

    try {
      const session = connectionManager.getSession();
      const subscription = ClientSubscription.create(session, {
        requestedPublishingInterval,
        requestedLifetimeCount,
        requestedMaxKeepAliveCount,
        maxNotificationsPerPublish,
        publishingEnabled: true,
        priority,
      });

      subscriptions.push(subscription);

      subscription
        .on("started", () => {
          plugin.log(`Subscription ${subscription.subscriptionId} started - subscriptionId=${subscription.subscriptionId}`, 1);
        })
        .on("keepalive", () => {
          plugin.log(`Keepalive received from subscription ${subscription.subscriptionId}`, 2);
          connectionManager.updateKeepAlive();
        })
        .on("terminated", () => {
          plugin.log(`Subscription ${subscription.subscriptionId} terminated`, 2);
          const index = subscriptions.indexOf(subscription);
          if (index > -1) {
            subscriptions.splice(index, 1);
          }
        });

      return subscription;
    } catch (err) {
      plugin.log(`Subscription error: ${util.inspect(err)}`, 2);
      return null;
    }
  }

  function monitor(params, channels) {
    const groupChannels = groupByUniq(channels, 'parentnodefolder');
    curChannels = groupBy(channels, 'chan');
    const { samplingInterval, discardOldest, queueSize, maxVariablesSub, maxVariablesMon } = params;
    const maxChannelsPerSubscription = maxVariablesSub || 4000;

    const allItemsToMonitor = [];

    Object.keys(groupChannels).forEach(key => {
      let parameters = {};
      if (key == "undefined") {
        parameters = {
          samplingInterval: samplingInterval || 100,
          discardOldest: discardOldest == 1,
          queueSize: queueSize || 10,
          maxVariablesMon: maxVariablesMon || 100
        };
      } else {

        if (groupChannels[key].ref[0].dataChangeFilter) {
          const deadbandType = groupChannels[key].ref[0].parentfilterDeadbandType || 1
          const deadbandValue = groupChannels[key].ref[0].parentfilterDeadbandValue || 1
          const trigger = groupChannels[key].ref[0].parentfilterDataChangeTrigger || 1
          const filter = new DataChangeFilter({
            trigger,
            deadbandType,
            deadbandValue
          })

          parameters = {
            samplingInterval: groupChannels[key].ref[0].parentsamplingInterval || 100,
            discardOldest: groupChannels[key].ref[0].parentdiscardOldest == 1,
            queueSize: groupChannels[key].ref[0].parentqueueSize || 10,
            maxVariablesMon: maxVariablesMon || 100,
            filter
          };
        } else {
          parameters = {
            samplingInterval: groupChannels[key].ref[0].parentsamplingInterval || 100,
            discardOldest: groupChannels[key].ref[0].parentdiscardOldest == 1,
            queueSize: groupChannels[key].ref[0].parentqueueSize || 10,
            maxVariablesMon: maxVariablesMon || 100
          };
        }
      }

      groupChannels[key].ref.forEach((channel) => {
        allItemsToMonitor.push({
          nodeId: channel.chan,
          attributeId: AttributeIds.Value,
          parameters: parameters
        });
      });
    });

    plugin.log(`Total items to monitor: ${allItemsToMonitor.length}, max per subscription: ${maxChannelsPerSubscription}`, 1);

    const subscriptionGroups = [];

    for (let i = 0; i < allItemsToMonitor.length; i += maxChannelsPerSubscription) {
      const group = allItemsToMonitor.slice(i, i + maxChannelsPerSubscription);
      subscriptionGroups.push(group);
    }

    plugin.log(`Created ${subscriptionGroups.length} subscription groups`, 1);

    subscriptionGroups.forEach((group, index) => {
      createSubscriptionWithItems(group, index);
    });

    plugin.log(`Created ${subscriptions.length} subscriptions for ${allItemsToMonitor.length} channels`, 1);
  }

  function createSubscriptionWithItems(items, subscriptionIndex) {
    if (items.length === 0) return;

    const itemsByParams = {};
    items.forEach(item => {
      const paramsKey = JSON.stringify(item.parameters);
      if (!itemsByParams[paramsKey]) {
        itemsByParams[paramsKey] = {
          parameters: item.parameters,
          items: []
        };
      }
      itemsByParams[paramsKey].items.push({
        nodeId: item.nodeId,
        attributeId: item.attributeId,
      });
    });

    const subscription = subscribe(plugin.params.data, subscriptionIndex);
    if (!subscription) {
      plugin.log(`Failed to create subscription ${subscriptionIndex}`, 2);
      return;
    }

    Object.values(itemsByParams).forEach((group, groupIndex) => {
      const { items: groupItems, parameters } = group;

      if (groupItems.length > 0) {
        try {
          const monitoredItem = ClientMonitoredItemGroup.create(
            subscription,
            groupItems,
            parameters,
            TimestampsToReturn.Both
          );

          monitoredItemArr.push(monitoredItem);

          monitoredItem.on('err', (monitorItem, dataValue) => {
            plugin.log(`monitorItem error: ${monitorItem} dataValue: ${dataValue}`, 2);
          });

          monitoredItem.on("changed", (monitorItem, dataValue) => {
            connectionManager.updateKeepAlive();
            plugin.log("dataValue " + util.inspect(dataValue));
            handleDataChange(monitorItem, dataValue);
          });

          plugin.log(`Created monitored item group ${groupIndex} with ${groupItems.length} items in subscription ${subscriptionIndex}`, 2);
        } catch (err) {
          plugin.log(`Error creating monitored item group: ${util.inspect(err)}`, 2);
        }
      }
    });
  }

  function handleDataChange(monitorItem, dataValue) {
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

    if (curChannels[chanId] && curChannels[chanId].ref) {
      curChannels[chanId].ref.forEach(item => {
        if (item.dataType.toUpperCase() == 'INT64' || item.dataType.toUpperCase() == 'LINT' || dataValue.value.dataType == 8) {
          value = wordsToBigInt(dataValue.value.value, 'INT64')
        }
        if (item.dataType.toUpperCase() == 'UINT64' || item.dataType.toUpperCase() == 'LWORD' || dataValue.value.dataType == 9) {
          value = wordsToBigInt(dataValue.value.value, 'UINT64')
        }
        toSend.push({
          chanId,
          id: item.id,
          value: value,
          chstatus: dataValue.statusCode._value,
          quality: dataValue.statusCode._value,
          ts: use_system_ts ? Date.now() : ts
        });
      });
    }
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

  async function write(data) {
    plugin.log(util.inspect(data), 2);
    const session = connectionManager.getSession();
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
              sendArr.push({ id: item.itemId, value: item.value.value.value, chstatus: 0, quality: 0, ts: Date.now() });
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
    const session = connectionManager.getSession();
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
    const status = await connectionManager.connect(connectionParams);
    if (status) {
      monitor(plugin.params.data, plugin.channels.data);
    }
    return status;
  }

  // Запуск основной логики
  main(plugin.params.data);

  plugin.onScan((scanObj) => {
    if (!scanObj) return;
    if (scanObj.stop) {
      //
    } else {
      scanner.request(connectionManager.getSession(), scanObj.uuid);
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
    monitoredItemArr.forEach(item => item.terminate());
    subscriptions.forEach(sub => sub.terminate());
    subscriptions = [];
    await connectionManager.terminate();
  }
};

async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}