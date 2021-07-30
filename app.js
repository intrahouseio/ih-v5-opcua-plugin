/**
 * app.js
 *
 */

const util = require('util');

const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,

  ClientSubscription,
  TimestampsToReturn,
  ClientMonitoredItem,
  DataType
} = require('node-opcua');

const Scanner = require('./lib/scanner');
// const client = require('./lib/fakeclient');

let client;
let session;

module.exports = async function(plugin) {
  const scanner = new Scanner(plugin);

  const connectionStrategy = {
    initialDelay: 1000,
    maxRetry: 1
  };

  client = OPCUAClient.create({
    applicationName: 'MyClient',
    connectionStrategy,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false
  });

  async function main() {
    const { host, port, use_password, userName, password } = plugin.params.data;
    const endpointUrl = 'opc.tcp://192.168.0.88:4840';
    // const endpointUrl = 'opc.tcp://opcuademo.sterfive.com:26543';

    try {
      // step 1 : connect to
      await client.connect(endpointUrl);
      console.log('connected !');

      // step 2 : createSession
      session = await client.createSession({ userName: 'admin', password: 'wago' });
      // session = await client.createSession();
      console.log('session created !');

      // step 3 : try write
      session.write(
        {
          nodeId: 'ns=4;s=|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.d',
          attributeId: AttributeIds.Value,
          value: {
            value: {
              dataType: DataType.String,
              value: 'New value'
            }
          }
        },
        (err, statusCode) => {
          if (!err) {
            plugin.log('Write OK');
          } else {
            console.log('Write ERROR: ' + util.inspect(err) + ' statusCode=' + statusCode);
          }
        }
      );

      // step 5: install a subscription and install a monitored item for 10 seconds
      /*
      const subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
      });
      
      subscription
        .on("started", () => {
          console.log(
            "subscription started for 2 seconds - subscriptionId=",
            subscription.subscriptionId
          );
        })
        .on("keepalive", () => {
          console.log("keepalive");
        })
        .on("terminated", () => {
          console.log("terminated");
        });
      
      // install monitored item
      const itemToMonitor = {
        nodeId: "ns=4;s=|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.b",
        attributeId: AttributeIds.Value
      };
      const parameters = {
        samplingInterval: 100,
        discardOldest: true,
        queueSize: 10
      };
      
      const monitoredItem = ClientMonitoredItem.create(
        subscription,
        itemToMonitor,
        parameters,
        TimestampsToReturn.Both
      );
      
      monitoredItem.on("changed", (xdataValue) => {
        console.log(" value has changed : ", xdataValue.value.toString());
      });
      */
    } catch (err) {
      console.log('An error has occured : ', err);
    }
  }

  main();

  // --- События плагина ---
  // Сканирование
  plugin.onScan(scanObj => {
    if (!scanObj) return;
    if (scanObj.stop) {
      //
    } else {
      scanner.request(session, scanObj.uuid);
    }
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
};

async function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/**

nodeId = ReferenceDescription {
  referenceTypeId: NodeId { identifierType: 1, value: 35, namespace: 0 },
  isForward: true,
  nodeId: ExpandedNodeId {
    identifierType: 2,
    value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG',
    namespace: 4,
    namespaceUri: null,
    serverIndex: 0
  },
  browseName: QualifiedName { namespaceIndex: 4, name: 'PLC_PRG' },
  displayName: LocalizedText { locale: null, text: 'PLC_PRG' },
  nodeClass: 1,
  typeDefinition: ExpandedNodeId {
    identifierType: 1,
    value: 1004,
    namespace: 3,
    namespaceUri: null,
    serverIndex: 0
  }
}
END 7  ---------- 
   ->  4:a
nodeId = ReferenceDescription {
  referenceTypeId: NodeId { identifierType: 1, value: 4004, namespace: 3 },
  isForward: true,
  nodeId: ExpandedNodeId {
    identifierType: 2,
    value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.a',
    namespace: 4,
    namespaceUri: null,
    serverIndex: 0
  },
  browseName: QualifiedName { namespaceIndex: 4, name: 'a' },
  displayName: LocalizedText { locale: null, text: 'a' },
  nodeClass: 2,
  typeDefinition: ExpandedNodeId {
    identifierType: 1,
    value: 63,
    namespace: 0,
    namespaceUri: null,
    serverIndex: 0
  }
}

 */
