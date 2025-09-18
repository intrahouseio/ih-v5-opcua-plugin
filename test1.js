const opcua = require("node-opcua");

// Конфигурация
const endpointUrl = "opc.tcp://192.168.0.87:4840"; // Ваш сервер
const variableNodeId = "ns=4;s=|var|CODESYS Control Win V3.Application.PLC_PRG.testlWORD";

async function readVariableAndFindBaseType() {
    let client, session;

    try {
        // Создаем клиент
        client = opcua.OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 10,
                initialDelay: 1000,
                maxDelay: 20000
            },
            securityMode: opcua.MessageSecurityMode.None, // Настройте при необходимости
            securityPolicy: opcua.SecurityPolicy.None // Настройте при необходимости
        });

        console.log(`Подключение к серверу OPC UA: ${endpointUrl}...`);
        await client.connect(endpointUrl);
        console.log("Подключение успешно!");

        // Создаем сессию
        session = await client.createSession();
        console.log("Сессия создана!");

        // Чтение значения переменной
        const dataValue = await session.read({
            nodeId: variableNodeId,
            attributeId: opcua.AttributeIds.Value
        });

        if (dataValue.statusCode.isGood()) {
            console.log(`Значение переменной (${variableNodeId}):`, dataValue.value.value);
        } else {
            console.error(`Ошибка чтения значения: ${dataValue.statusCode.toString()}`);
        }

        // Чтение DataType для переменной
        const typeDefResult = await session.read({
            nodeId: variableNodeId,
            attributeId: opcua.AttributeIds.DataType
        });

        if (typeDefResult.statusCode.isGood() && typeDefResult.value.value) {
            const typeNodeId = typeDefResult.value.value;
            console.log(`DataType: ${typeNodeId.toString()}`);

            // Проверяем, является ли тип нестандартным (namespace > 0)
            const namespaceIndex = typeNodeId.namespace;
            if (namespaceIndex > 0) {
                console.log(`Обнаружен нестандартный тип (namespace: ${namespaceIndex})`);

                // Чтение базового типа через browse
                const browseResult = await session.browse({
                    nodeId: typeNodeId,
                    browseDirection: opcua.BrowseDirection.Inverse,
                    referenceTypeId: "i=45", // HasSubtype
                    includeSubtypes: true,
                    nodeClassMask: opcua.NodeClass.DataType,
                    resultMask: 0x3F // Комбинация всех флагов (BrowseName, NodeId, NodeClass и т.д.)
                });

                if (browseResult.statusCode.isGood() && browseResult.references && browseResult.references.length > 0) {
                    const baseTypeNodeId = browseResult.references[0].nodeId;
                    console.log(`Базовый тип (HasSubtype): ${baseTypeNodeId.toString()}`);

                    // Получение имени базового типа (BrowseName)
                    const browseNameResult = await session.read({
                        nodeId: baseTypeNodeId,
                        attributeId: opcua.AttributeIds.BrowseName
                    });
                    if (browseNameResult.statusCode.isGood()) {
                        console.log(`Имя базового типа: ${browseNameResult.value.value.name}`);
                    }
                } else {
                    console.log(`Не удалось найти базовый тип: ${browseResult.statusCode.toString()}`);
                }
            } else {
                console.log(`Тип является стандартным (namespace=0): ${typeNodeId.toString()}`);
            }
        } else {
            console.error(`Не удалось прочитать DataType: ${typeDefResult.statusCode.toString()}`);
        }

    } catch (err) {
        console.error("Ошибка:", err.message);
    } finally {
        if (session) {
            await session.close();
            console.log("Сессия закрыта.");
        }
        if (client) {
            await client.disconnect();
            console.log("Отключение от сервера.");
        }
    }
}

readVariableAndFindBaseType().catch(err => {
    console.error("Фатальная ошибка:", err);
    process.exit(1);
});