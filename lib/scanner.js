/**
 * scanner.js
 *  Сканирование узлов для показа их в виде дерева
 */

const util = require('util');

const { AttributeIds, NodeId, DataType, BrowseDirection, NodeClass} = require('node-opcua');

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
            
            const leaf = await createVariableLeaf(ref, chan, parentId, parentNodeId, this.session, parent.title, this.plugin)
            this.scanArray.push(leaf);
            
            // Накапливаем данные вместо немедленной отправки
            this.pendingTreeParts.push({ data: leaf, parentid: id });
          } else {
            const leaf = await createVariableLeaf(ref, chan, parentId, parentNodeId, this.session, parent.title, this.plugin)
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
      //this.plugin.log("parentId " + parentId)
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

async function createVariableLeaf(ref, chan, parentId, parentNodeId, session, displayName, plugin) {
  try {
    const data = await session.readAllAttributes(chan);
    let dtype = "";
    let baseDataType = "Unknown"; // Для хранения базового типа

    const { identifierType, identifierString } = getIdentifierTypeAndString(data.dataType?.identifierType || 0);

    // Проверяем, является ли data.dataType валидным NodeId
    if (data.dataType && data.dataType.identifierType !== undefined) {
      if (identifierType === 'BYTEString') {
        dtype = `ns=${data.dataType.namespace}${identifierString}${data.dataType.value.toString('base64')}`;
      } else if (identifierType === 'String') {
        dtype = `ns=${data.dataType.namespace}${identifierString}${data.dataType.value}`;
      } else if (identifierType === 'Numeric' && data.dataType.value > 15) {
        dtype = `ns=${data.dataType.namespace}${identifierString}${data.dataType.value}`;
      } else {
        dtype = getDtype(data.dataType.value);
      }

      // Проверяем, является ли узел встроенным типом данных
      if (data.dataType.namespace === 0 && data.dataType.identifierType === 1 && data.dataType.value <= 15) {
        plugin.log(`Skipping getBuiltInDataType for built-in type ${dtype}`, 1);
        baseDataType = dtype; // Для стандартных типов базовый тип совпадает
      } else {
        try {
          // Проверяем, является ли тип нестандартным (namespace > 0)
          if (data.dataType.namespace > 0) {
            plugin.log(`Обнаружен нестандартный тип для ${chan}: ${dtype}`, 1);

            // Выполняем browse для получения базового типа
            const browseResult = await session.browse({
              nodeId: data.dataType,
              browseDirection: BrowseDirection.Inverse,
              referenceTypeId: "i=45", // HasSubtype
              includeSubtypes: true,
              nodeClassMask: NodeClass.DataType,
              resultMask: 0x3F // Все флаги (BrowseName, NodeId, NodeClass и т.д.)
            });

            if (browseResult.statusCode.isGood() && browseResult.references && browseResult.references.length > 0) {
              const baseTypeNodeId = browseResult.references[0].nodeId;
              baseDataType = baseTypeNodeId.toString();

              // Получаем имя базового типа
              const browseNameResult = await session.read({
                nodeId: baseTypeNodeId,
                attributeId: AttributeIds.BrowseName
              });
              if (browseNameResult.statusCode.isGood()) {
                baseDataType = browseNameResult.value.value.name;
                plugin.log(`Базовый тип для ${chan}: ${baseDataType} (${baseTypeNodeId})`, 1);
              }
            } else {
              plugin.log(`Не удалось найти базовый тип для ${chan}: ${browseResult.statusCode.toString()}`, 2);
            }
          } else {
            baseDataType = dtype; // Для стандартных типов (namespace=0)
            plugin.log(`Стандартный тип для ${chan}: ${dtype}`, 1);
          }
        } catch (err) {
          plugin.log(`Warning: Failed to get base data type for ${chan}: ${util.inspect(err)}`, 2);
        }
      }
    } else {
      plugin.log(`Warning: Invalid dataType for ${chan}, using default`, 2);
      dtype = "Unknown";
    }

    const accessLevel = getAccessLevel(data.accessLevel || 0);
    let curValue = data.dataType?.value !== 22 ? JSON.stringify(data.value) : data.value;

    return {
      nodeId: ref.nodeId,
      parentId,
      id: chan,
      title: `${data.displayName?.text || 'Unnamed'} (${dtype}, Base: ${baseDataType}) ${curValue || ''} (${data.statusCode?._name || 'Unknown'})`,
      dataType: dtype,
      baseDataType, // Добавляем базовый тип
      accessLevel,
      statusCode: data.statusCode?._name || 'Unknown',
      channel: {
        topic: data.displayName?.text || 'Unnamed',
        title: data.displayName?.text || 'Unnamed',
        parentfolder: { id: parentId, title: displayName || 'Unnamed' },
        devpropname: data.displayName?.text || 'Unnamed',
        dataType: baseDataType,
        chan,
        accessLevel,
        statusCode: data.statusCode?._value || 0,
        objectId: parentNodeId,
      }
    };
  } catch (e) {
    plugin.log(`ERROR in createVariableLeaf for ${chan}: ${util.inspect(e)}`, 2);
    return {
      nodeId: ref.nodeId,
      parentId,
      id: chan,
      title: `Error: Failed to read attributes for ${chan}`,
      dataType: "Error",
      baseDataType: "Error",
      accessLevel: "None",
      statusCode: "Bad",
      channel: {
        topic: "Error",
        title: "Error",
        parentfolder: { id: parentId, title: displayName || 'Unnamed' },
        devpropname: "Error",
        dataType: "Error",
        baseDataType: "Error",
        chan,
        accessLevel: "None",
        statusCode: 0,
        objectId: parentNodeId,
      }
    };
  }
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