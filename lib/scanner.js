/**
 * scanner.js
 *  Сканирование узлов для показа их в виде дерева
 */

const util = require('util');

const { AttributeIds, NodeId } = require('node-opcua');

class Scanner {
  constructor(plugin) {
    this.plugin = plugin;
    this.status = 0; // 0 - сканирование не активно, 1 - первое дерево, 2 - дерево достраивается
    this.clients = new Set(); // Список uuid клиентов сканирования
  }

  async start(session) {
    this.status = 1;
    
    this.session = session;
    this.scanArray = [
      {
        id: 'RootFolder',
        browseName: 'RootFolder',
        title: 'RootFolder',
        nodeClass: 1,
        parentId: ''
      }
    ];
    this.idSet = new Set();
    
    // Очищаем буфер для накопления данных
    this.pendingTreeParts = [];
    
    // Отправка дерева первый раз, дальше досылается как add
    const data = [this.makeTree()];
    this.clients.forEach(uuid => this.sendTree(uuid, data));
    this.status = 2;

    try {
      await this.scanning('RootFolder');
      // Отправляем все накопленные данные после завершения сканирования
      this.sendAllTreeParts('RootFolder');
      
      this.stop();
    } catch (e) {
      this.plugin.log('ERROR ' + util.inspect(e), 2);
    }
  }

  async request(session, uuid) {
    // Всех подписчиков записать в список, чтобы им потом отправить дерево
    this.clients.add(uuid);

    if (this.status == 2) {
      this.sendTree(uuid); // Дерево готово - сразу отправляем
    } else {
      // Всех подписчиков записывать в список, чтобы им потом отправить дерево
      this.clients.add(uuid);

      if (this.status == 0) {
        this.start(session);
      }
    }
  }

  // Рекурсивная процедура сканирования
  async scanning(nodeId, referenceTypeId, parent) {
    try {
      let parentId = parent ? parent.id : getId(nodeId) + getId(referenceTypeId);
      const parentNodeId = String(nodeId);
      const browseResult = await this.session.browse(nodeId);
      if (!browseResult || !browseResult.references || !Array.isArray(browseResult.references)) return;
      
      for (let i = 0; i < browseResult.references.length; i++) {
        let ref = browseResult.references[i];
        const displayName = ref.displayName.text;
        if (ref.nodeClass == 1) {
          const id = getId(ref.nodeId) + getId(ref.referenceTypeId);
          if (this.idSet.has(id)) continue;
          this.idSet.add(id);
          const branch = { nodeId: ref.nodeId, typeId: ref.referenceTypeId, parentId, id, title: displayName };
          this.scanArray.push(branch);
          
          // Накапливаем данные вместо немедленной отправки
          this.pendingTreeParts.push({ data: { ...branch, children: [] }, parentid: parentId });
          
          //await this.scanning(ref.nodeId, ref.referenceTypeId, branch);
        } else if (ref.nodeClass == 2 && ref.nodeId.identifierType) {
          const { identifierType, identifierString } = getIdentifierTypeAndString(ref.nodeId.identifierType);
          let chan = "";
          if (identifierType == 'BYTEString') {
            chan = 'ns=' + ref.nodeId.namespace + identifierString + ref.nodeId.value.toString('base64');
          } else {
            chan = 'ns=' + ref.nodeId.namespace + identifierString + ref.nodeId.value;
          }

          if (this.idSet.has(chan)) continue;
          this.idSet.add(chan);

          const refs = await this.session.browse(ref.nodeId);
          if (refs.references.length > 0) {
            const id = getId(ref.nodeId) + getId(ref.referenceTypeId);
            if (this.idSet.has(id)) continue;
            this.idSet.add(id);
            const branch = { nodeId: ref.nodeId, typeId: ref.referenceTypeId, parentId, id, title: displayName };
            this.scanArray.push(branch);
            
            // Накапливаем данные вместо немедленной отправки
            this.pendingTreeParts.push({ data: { ...branch, children: [] }, parentid: parentId });
            
            const leaf = await createVariableLeaf(ref, chan, parentId, parentNodeId, this.session, parent.title)
            this.scanArray.push(leaf);
            
            // Накапливаем данные вместо немедленной отправки
            this.pendingTreeParts.push({ data: leaf, parentid: id });
          } else {
            const leaf = await createVariableLeaf(ref, chan, parentId, parentNodeId, this.session, parent.title)
            this.scanArray.push(leaf);
            
            // Накапливаем данные вместо немедленной отправки
            this.pendingTreeParts.push({ data: leaf, parentid: parentId });
          }

        } else if (ref.nodeClass == 4 && ref.nodeId.identifierType) {
          const { identifierType, identifierString } = getIdentifierTypeAndString(ref.nodeId.identifierType);
          let chan;
          if (identifierType == 'BYTEString') {
            chan = 'ns=' + ref.nodeId.namespace + identifierString + ref.nodeId.value.toString('base64');
          } else {
            chan = 'ns=' + ref.nodeId.namespace + identifierString + ref.nodeId.value;
          }
          if (this.idSet.has(chan)) continue;
          this.idSet.add(chan);
          const data = await this.session.readAllAttributes(chan);
          const dtype = "Method";
          const accessLevel = getAccessLevel(data.accessLevel);
          const leaf = {
            nodeId: ref.nodeId,
            parentId,
            id: chan,
            title: data.displayName.text + ' (' + dtype + ') (' + data.statusCode._name + ') ',
            dataType: dtype,
            accessLevel: accessLevel,
            statusCode: data.statusCode._name,
            channel: {
              topic: data.displayName.text,
              title: data.displayName.text,
              parentfolder:{id:parentId, title:displayName},
              devpropname: data.displayName.text,
              dataType: dtype,
              chan: chan,
              accessLevel: accessLevel,
              statusCode: data.statusCode._value,
              objectId: parentNodeId,
              r: 0,
              w: 1
            }
          };
          this.scanArray.push(leaf);
          
          // Накапливаем данные вместо немедленной отправки
          this.pendingTreeParts.push({ data: leaf, parentid: parentId });
        }
      }
    } catch (e) {
      this.plugin.log('ERROR scanning ' + util.inspect(e), 2);
    }
  }

  // Отправка всех накопленных данных одним пакетом
  sendAllTreeParts() {
    // Отправляем все накопленные части дерева
    this.pendingTreeParts.forEach(part => {
      this.plugin.send({ 
        type: 'scan', 
        op: 'add', 
        data: part.data, 
        parentid: part.parentid, 
        scanid: 'root' 
      });
    });
    // Очищаем буфер
    this.pendingTreeParts = [];
  }

  async scanExpand(scanObj) {
    if (scanObj.parent) {
      const parentId = scanObj.parent.id;
      this.plugin.log("parentId " + parentId)
      // Сохраняем оригинальный title
      const originalTitle = scanObj.parent.title;
      
      // Отправляем обновленный узел с индикацией загрузки
      this.plugin.send({
        type: 'scan',
        op: 'update',
        data: {
          [parentId] : { title: originalTitle + ' (Loading...)' }
        },
        scanid: 'root'
      });
      
      // Для expand также используем накопление данных
      this.pendingTreeParts = []; // Очищаем буфер для expand
      
      try {
        await this.scanning(scanObj.parent.nodeId, scanObj.parent.typeId, scanObj.parent);
        
        // Восстанавливаем оригинальный title после завершения сканирования
        this.plugin.send({
          type: 'scan',
          op: 'update',
          data: {
            [parentId] : { title: originalTitle }
          },
          scanid: 'root'
        });
        
        this.sendAllTreeParts(); // Отправляем накопленные данные
        
      } catch (error) {
        this.plugin.log('ERROR in scanExpand: ' + util.inspect(error), 2);
        // В случае ошибки тоже восстанавливаем оригинальный title
        this.plugin.send({
          type: 'scan',
          op: 'update',
          data: {
            [parentId] : { title: originalTitle }
          },
          scanid: 'root'
        });
      }
    }
  }

  // Отправка дерева клиенту uuid
  sendTree(uuid, data) {
    if (!data) data = [this.makeTree()];
    this.plugin.send({ type: 'scan', op: 'list', data, uuid });
  }

  // Из массива this.scanArray формирует дерево
  makeTree() {
    const ids = this.scanArray.reduce((acc, el, i) => {
      acc[el.id] = i;
      return acc;
    }, {});

    let root;
    this.scanArray.forEach(el => {
      if (!el.parentId) {
        root = el;
        return;
      }
      const parentEl = this.scanArray[ids[el.parentId]];
      parentEl.children = [...(parentEl.children || []), el];
    });
    return root;
  }

  stop() {
    this.clients.clear();
    this.status = 0;
    this.pendingTreeParts = []; // Очищаем буфер при остановке
  }
}

module.exports = Scanner;

async function createVariableLeaf(ref, chan, parentId, parentNodeId, session, displayName) {
  const data = await session.readAllAttributes(chan);
  let dtype = ""
  const { identifierType, identifierString } = getIdentifierTypeAndString(data.dataType.identifierType);
  if (identifierType == 'BYTEString') {
    dtype = 'ns=' + data.dataType.namespace + identifierString + data.dataType.value.toString('base64');
  } else if (identifierType == 'String') {
    dtype = 'ns=' + data.dataType.namespace + identifierString + data.dataType.value;
  } else if (identifierType == 'Numeric' && data.dataType.value > 15) {
    dtype = 'ns=' + data.dataType.namespace + identifierString + data.dataType.value;
    //nodeType = await this.session.getBuiltInDataType(data.dataType.value.value);               
  } else {
    dtype = getDtype(data.dataType.value);
  }

  const accessLevel = getAccessLevel(data.accessLevel);
  let curValue = data.dataType.value != 22 ? JSON.stringify(data.value) : data.value;
  return {
    nodeId: ref.nodeId,
    parentId,
    id: chan,
    title: data.displayName.text + ' (' + dtype + ') ' + curValue + ' (' + data.statusCode._name + ') ',
    dataType: dtype,
    accessLevel: accessLevel,
    statusCode: data.statusCode._name,
    channel: {
      topic: data.displayName.text,
      title: data.displayName.text,
      parentfolder: {id:parentId, title: displayName},
      devpropname: data.displayName.text,
      dataType: dtype,
      chan: chan,
      accessLevel: accessLevel,
      statusCode: data.statusCode._value,
      objectId: parentNodeId,
    }
  };
}

function getId(nodeId) {
  if (!nodeId) return '';
  if (typeof nodeId != 'object') return nodeId;
  const { identifierType, value, namespace } = nodeId;
  return String(identifierType) + '_' + String(value) + '_' + String(namespace);
}

function getIdentifierTypeAndString(iType) {
  let identifierType;
  let identifierString;
  switch (iType) {
    case 1:
      identifierType = 'Numeric';
      identifierString = ';i=';
      break;
    case 2:
      identifierType = 'String';
      identifierString = ';s=';
      break;
    case 3:
      identifierType = 'GUID';
      identifierString = ';g=';
      break;
    case 4:
      identifierType = 'BYTEString';
      identifierString = ';b=';
      break;
    default:
      identifierType = String(iType);
      identifierString = String(iType);
      break;
  }
  return { identifierType, identifierString };
}

function getDtype(dataTypeValue) {
  switch (dataTypeValue) {
    case 0:
      return 'Null';

    case 1:
      return 'Boolean';

    case 2:
      return 'SByte';

    case 3:
      return 'Byte';

    case 4:
      return 'Int16';

    case 5:
      return 'UInt16';

    case 6:
      return 'Int32';

    case 7:
      return 'UInt32';

    case 8:
      return 'Int64';

    case 9:
      return 'UInt64';

    case 10:
      return 'Float';

    case 11:
      return 'Double';

    case 12:
      return 'String';

    case 13:
      return 'DateTime';

    case 14:
      return 'Guid';

    case 15:
      return 'ByteString';

    default:
      return String(dataTypeValue);
  }
}

function getAccessLevel(dataAccessLevel) {
  switch (dataAccessLevel) {
    case 1:
      return 'Read Only';

    case 2:
      return 'Write Only';

    case 3:
      return 'Read Write';

    default:
      return String(dataAccessLevel);
  }
}