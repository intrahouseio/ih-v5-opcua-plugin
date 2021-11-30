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
      console.log('ERROR ' + util.inspect(e));
    }
  }

  // Рекурсивная процедура сканирования
  // Формирует массив this.scanArray
  async scanning(nodeId) {
    try {
      const parentId = typeof nodeId == 'object' ? String(nodeId.value) : nodeId;
      const browseResult = await this.session.browse(nodeId);
      // console.log('scanning parentId=' + parentId + ' browseResult=' + util.inspect(browseResult));
      if (!browseResult || !browseResult.references || !Array.isArray(browseResult.references)) return;

      for (const ref of browseResult.references) {
        const displayName = ref.displayName.text;
        if (ref.nodeClass == 1) {
          this.scanArray.push({ nodeId: ref.nodeId, parentId, id: String(ref.nodeId.value), title: displayName });
          await this.scanning(ref.nodeId);
        } else if (ref.nodeClass == 2) {
          //const dtype = await this.session.getBuiltInDataType(ref.nodeId);
          // let dataValue = '';
          const chan = 'ns=' + ref.nodeId.namespace + ';s=' + ref.nodeId.value;
          /*const nodeToRead = {
            nodeId: chan,
            attributeId: AttributeIds.Value

          };*/
          //console.log('nodeToRead: ' + nodeToRead.nodeId);

          //const dataValue = await this.session.read(nodeToRead, 0);
          const data = await this.session.readAllAttributes(chan);
          //let accessLevel =  await this.session.readAttribute(ref.nodeId, AttributeIds.AccessLevel);
          //console.log('AllData: ' + util.inspect(data));
          /**
           * dataValue={
          value: Variant(Scalar<String>, value: Hello WORLD)
          statusCode:      Good (0x00000)
          serverTimestamp: 2021-07-29T07:41:31.833Z $ 165.900.000
          sourceTimestamp: 2021-07-29T07:41:31.833Z $ 163.000.000
          }
           */


          //const curValue = dataValue.value.value && dtype != 22 ? JSON.stringify(dataValue.value.value) : '';
          let dtype = '';
          let accessLevel = '';
          if (typeof data.dataType != "undefined") {

            //const dtype = data.dataType.value;
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
              channel: { topic: data.displayName.text, title: data.displayName.text, dataType: dtype, chan: chan, accessLevel: accessLevel, statusCode: data.statusCode._value }
            });
          }
        }
      }
    } catch (e) {
      console.log('ERROR scanning ' + util.inspect(e));
    }
  }

  sendTree(uuid, data) {
    if (!data) data = [this.makeTree()];
    // console.log('SEND SCAN TREE for ' + uuid + ': ' + util.inspect(data, null, 7));
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
      // console.log('el=' + util.inspect(el) + ' el.parentId=' + el.parentId);
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
