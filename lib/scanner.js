/**
 * scanner.js
 *  Сканирование узлов для показа их в виде дерева
 */

const util = require('util');

const { AttributeIds } = require('node-opcua');


class Scanner {
  constructor(plugin) {
    this.plugin = plugin;

    // TODO Если сканирование запрашивает несколько клиентов, то
    //   не запускать сканирование несколько раз, отдать всем результат по окончании сканирования
    // Этот функционал в данном плагине пока не реализован 
    this.status = 0; // 0 - сканирование не активно, 1 - идет построение дерева
    this.clients = new Set(); // Список uuid клиентов сканирования
  }

  // Обработка запроса на сканирование
  async request(session, uuid) {
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

    try {
      await this.scanning('RootFolder');
      this.sendTree(uuid);
    } catch (e) {
      this.plugin.log('ERROR ' + util.inspect(e));
    }
  }

  // Рекурсивная процедура сканирования
  // Формирует массив this.scanArray
  async scanning(nodeId) {
    try {
      const parentId = typeof nodeId == 'object' ? String(nodeId.value) : nodeId;
      const browseResult = await this.session.browse(nodeId);
      if (!browseResult || !browseResult.references || !Array.isArray(browseResult.references)) return;
      for (const ref of browseResult.references) {
        const displayName = ref.displayName.text;
        if (ref.nodeClass == 1) {
          this.scanArray.push({ nodeId: ref.nodeId, parentId, id: String(ref.nodeId.value), title: displayName });
          await this.scanning(ref.nodeId);
        } else if (ref.nodeClass == 2) {
          let identifierType ='';
          let identifierString = '';
          if (typeof ref.nodeId != "undefined") {
            switch (ref.nodeId.identifierType) {
              case 1 : identifierType = 'Numeric'; identifierString = ';i='; break;
              case 2 : identifierType = 'String'; identifierString = ';s='; break;
              case 3 : identifierType = 'GUID'; identifierString = ';g='; break;
              case 4 : identifierType = 'BYTEString'; identifierString = ';b='; break;
              default: identifierType = String(ref.nodeId.identifierType); break;
            }
          }
          let chan;
          if (identifierType == 'BYTEString') {
            chan = 'ns=' + ref.nodeId.namespace + identifierString + ref.nodeId.value.toString('base64');
          } else {
            chan = 'ns=' + ref.nodeId.namespace + identifierString + ref.nodeId.value;
          }
         
          const data = await this.session.readAllAttributes(chan);
          
          let dtype = '';
          let accessLevel = '';
          
          if (typeof data.dataType != "undefined") {
            switch (data.dataType.value) {
              case 0: dtype = 'Null';
                break;
              case 1: dtype = 'Boolean';
                break;
              case 2: dtype = 'SByte';
                break;
              case 3: dtype = 'Byte';
                break;
              case 4: dtype = 'Int16';
                break;
              case 5: dtype = 'UInt16';
                break;
              case 6: dtype = 'Int32';
                break;
              case 7: dtype = 'UInt32';
                break;
              case 8: dtype = 'Int64';
                break;
              case 9: dtype = 'UInt64';
                break;
              case 10: dtype = 'Float';
                break;
              case 11: dtype = 'Double';
                break;
              case 12: dtype = 'String';
                break;
              case 13: dtype = 'DateTime';
                break;
              case 14: dtype = 'Guid';
                break;
              case 15: dtype = 'ByteString';
                break;
              default: dtype = String(data.dataType.value);
            }
            const curValue = data.value && data.dataType.value != 22 ? JSON.stringify(data.value) : '';
            //this.plugin.log("Statuscode" + util.inspect(data.statusCode._name));
            
            switch (data.accessLevel) {
              case 1: accessLevel = 'Read Only';
                break;
              case 2: accessLevel = 'Write Only';
                break;
              case 3: accessLevel = 'Read Write';
                break;
              default: accessLevel = String(data.accessLevel);
            }
            //this.plugin.log(
            //  'channel: ' + data.displayName.text + ' dtype=' + dtype + ' dataValue=' + curValue + " accessLevel=" + accessLevel + "statusCode " + data.dataValue.statusCode.value.toString(16)
            //);
            
            this.scanArray.push({
              nodeId: ref.nodeId,
              parentId,
              id: chan,
              title: data.displayName.text + ' (' + dtype + ') ' + curValue + ' (' + data.statusCode._name + ') ',
              dataType: dtype,
              accessLevel: accessLevel,
              statusCode: data.statusCode._name,
              channel: { topic: data.displayName.text, title: data.displayName.text, devpropname: data.displayName.text, dataType: dtype, chan: chan, accessLevel: accessLevel, statusCode: data.statusCode._value }
            });
          }
        }
      }
    } catch (e) {
      this.plugin.log('ERROR scanning ' + util.inspect(e));
    }
  }

  sendTree(uuid, data) {
    if (!data) data = [this.makeTree()];
    // this.plugin.log('SEND SCAN TREE for ' + uuid + ': ' + util.inspect(data, null, 7));
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
      // this.plugin.log('el=' + util.inspect(el) + ' el.parentId=' + el.parentId);
      if (!el.parentId) {
        root = el;
        return;
      }
      const parentEl = this.scanArray[ids[el.parentId]];
      parentEl.children = [...(parentEl.children || []), el];
    });
    return root;
  }

  // TODO Останов сканирования - пока не реализовано
  stop() {
    this.clients.clear();
    this.status = 0;
    this.scanTree = '';
  }
}

module.exports = Scanner;
