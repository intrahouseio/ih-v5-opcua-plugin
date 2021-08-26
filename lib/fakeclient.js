/**
 * fakeclient.js
 */

module.exports = {
  connect(url) {
    console.log('Start connection ' + url);
  },
  createSession() {
    console.log('createSession ');
    return new Session();
  }
};

class Session {
  browse(nodeId) {
    if (nodeId == 'RootFolder') {
      return data[nodeId];
    }
    if (typeof nodeId == 'object') {
      return data[nodeId.value];
    }
  }
}

const data = {
  RootFolder: {
    references: [
      {
        browseName: 'Objects',
        nodeClass: 1,
        nodeId: {
          identifierType: 1,
          value: 85,
          namespace: 0,
          namespaceUri: null,
          serverIndex: 0
        }
      },
      {
        browseName: 'Types',
        nodeClass: 1,
        nodeId: {
          identifierType: 1,
          value: 86,
          namespace: 0,
          namespaceUri: null,
          serverIndex: 0
        }
      }
    ]
  },

  85: {
    references: [
      {
        browseName: 'Server',
        nodeClass: 1,
        nodeId: {
          identifierType: 1,
          value: 2253,
          namespace: 0,
          namespaceUri: null,
          serverIndex: 0
        }
      },
      {
        browseName: '2:DeviceSet',
        nodeClass: 1,
        nodeId: {
          identifierType: 1,
          value: 5001,
          namespace: 2,
          namespaceUri: null,
          serverIndex: 0
        }
      }
    ]
  },
  5001: {
    references: [
      {
        referenceTypeId: { identifierType: 1, value: 35, namespace: 0 },
        isForward: true,
        nodeId: {
          identifierType: 2,
          value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG',
          namespace: 4,
          namespaceUri: null,
          serverIndex: 0
        },
        browseName: 'PLC_PRG',

        nodeClass: 1,
        typeDefinition: {
          identifierType: 1,
          value: 1004,
          namespace: 3,
          namespaceUri: null,
          serverIndex: 0
        }
      }
    ]
  },
  '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG': {
    references: [
      {
        referenceTypeId: { identifierType: 1, value: 4004, namespace: 3 },
        isForward: true,
        nodeId: {
          identifierType: 2,
          value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.a',
          namespace: 4,
          namespaceUri: null,
          serverIndex: 0
        },
        browseName: '4:a',

        nodeClass: 2,
        typeDefinition: {
          identifierType: 1,
          value: 63,
          namespace: 0,
          namespaceUri: null,
          serverIndex: 0
        }
      },
      {
        referenceTypeId: { identifierType: 1, value: 4004, namespace: 3 },
        isForward: true,
        nodeId: {
          identifierType: 2,
          value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.b',
          namespace: 4,
          namespaceUri: null,
          serverIndex: 0
        },
        browseName: '4:b' ,
        displayName: { locale: null, text: 'b' },
        nodeClass: 2,
        typeDefinition: {
          identifierType: 1,
          value: 63,
          namespace: 0,
          namespaceUri: null,
          serverIndex: 0
        }
      },
      {
        referenceTypeId: { identifierType: 1, value: 4004, namespace: 3 },
        isForward: true,
        nodeId: {
          identifierType: 2,
          value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.d',
          namespace: 4,
          namespaceUri: null,
          serverIndex: 0
        },
        browseName: '4:d' ,
        displayName: { locale: null, text: 'd' },
        nodeClass: 2,
        typeDefinition: {
          identifierType: 1,
          value: 63,
          namespace: 0,
          namespaceUri: null,
          serverIndex: 0
        }
      }
    ]
  }
};

/**
    ->  Objects
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 85,
  namespace: 0,
  namespaceUri: null,
  serverIndex: 0
}
   ->  Types
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 86,
  namespace: 0,
  namespaceUri: null,
  serverIndex: 0
}
   ->  Views
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 87,
  namespace: 0,
  namespaceUri: null,
  serverIndex: 0
}
 ---------- 
   ->  Server
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 2253,
  namespace: 0,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:DeviceSet
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 5001,
  namespace: 2,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:NetworkSet
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 6078,
  namespace: 2,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:DeviceTopology
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 6094,
  namespace: 2,
  namespaceUri: null,
  serverIndex: 0
}
 ---------- 
   ->  2:DeviceFeatures
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 15034,
  namespace: 2,
  namespaceUri: null,
  serverIndex: 0
}
   ->  4:WAGO 750-8215 PFC200 G2 4ETH CAN USB
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: 'WAGO 750-8215 PFC200 G2 4ETH CAN USB',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
 END 3 ---------- 
   ->  4:Resources
nodeId = ExpandedNodeId {
  identifierType: 1,
  value: 1001,
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
END 4  ---------- 
   ->  4:Application
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
END 5  ---------- 
   ->  4:Tasks
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|appo|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.Tasks',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  4:Programs
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|appo|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.Programs',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  4:GlobalVars
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|appo|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.GlobalVars',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:DeviceManual
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.DeviceManual',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:DeviceRevision
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.DeviceRevision',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:HardwareRevision
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.HardwareRevision',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:SoftwareRevision
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.SoftwareRevision',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:Manufacturer
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.Manufacturer',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:Model
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.Model',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:SerialNumber
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.SerialNumber',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
   ->  2:RevisionCounter
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|vprop|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.RevisionCounter',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
}
END 6  ---------- 
   ->  4:PLC_PRG
nodeId = ExpandedNodeId {
  identifierType: 2,
  value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG',
  namespace: 4,
  namespaceUri: null,
  serverIndex: 0
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
   ->  4:b
nodeId = ReferenceDescription {
  referenceTypeId: NodeId { identifierType: 1, value: 4004, namespace: 3 },
  isForward: true,
  nodeId: ExpandedNodeId {
    identifierType: 2,
    value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.b',
    namespace: 4,
    namespaceUri: null,
    serverIndex: 0
  },
  browseName: QualifiedName { namespaceIndex: 4, name: 'b' },
  displayName: LocalizedText { locale: null, text: 'b' },
  nodeClass: 2,
  typeDefinition: ExpandedNodeId {
    identifierType: 1,
    value: 63,
    namespace: 0,
    namespaceUri: null,
    serverIndex: 0
  }
}
   ->  4:d
nodeId = ReferenceDescription {
  referenceTypeId: NodeId { identifierType: 1, value: 4004, namespace: 3 },
  isForward: true,
  nodeId: ExpandedNodeId {
    identifierType: 2,
    value: '|var|WAGO 750-8215 PFC200 G2 4ETH CAN USB.Application.PLC_PRG.d',
    namespace: 4,
    namespaceUri: null,
    serverIndex: 0
  },
  browseName: QualifiedName { namespaceIndex: 4, name: 'd' },
  displayName: LocalizedText { locale: null, text: 'd' },
  nodeClass: 2,
  typeDefinition: ExpandedNodeId {
    identifierType: 1,
    value: 63,
    namespace: 0,
    namespaceUri: null,
    serverIndex: 0
  }
}
END 8  ---------- 

 */
