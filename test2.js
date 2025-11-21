const opcua = require("node-opcua");

// Параметры
const endpointUrl = "opc.tcp://localhost:1234";  // Полный URI
const namespaceIndex = 1;
const nodeId = `ns=${namespaceIndex};s=MyCounter`;
let counterValue = 0;  // Начальное значение

// 1. НАСТРОЙКА СЕРВЕРА
async function startServer() {
    // Создаём сервер с applicationUri, matching сертификату (для устранения warning)
    const server = new opcua.OPCUAServer({
        port: 1234,
        applicationUri: "urn:air-maksim:NodeOPCUA-Server",  // Укажите ваш из warning
        resourceRestrictions: {
            maxMonitoredItemsPerSubscription: 1000
        }
    });

    await server.initialize();

    // Добавляем пространство имён
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace("MyNamespace");

    // Добавляем папку
    const folder = namespace.addFolder("ObjectsFolder", {
        browseName: "MyFolder"
    });

    // Создаём переменную (Int32) с getter, возвращающим Variant
    const myVariable = namespace.addVariable({
        componentOf: folder,
        browseName: "MyCounter",
        nodeId: nodeId,
        dataType: "Int32",
        minimumSamplingInterval: 100,  // Явно указано для устранения warning
        value: {  // Начальное значение как Variant
            get: () => new opcua.Variant({
                dataType: opcua.DataType.Int32,
                value: counterValue
            })
        }
    });

    // Генерация изменений каждые 100 мс: +1
    // Используем setValueFromSource для обновления и триггера изменений
    setInterval(() => {
        counterValue += 1;
        myVariable.setValueFromSource(new opcua.Variant({
            dataType: opcua.DataType.Int32,
            value: counterValue
        }));
        // Убрали console.log для сервера, чтобы не мешать
    }, 100);

    await server.start();
    // Убрали console.log для сервера
    return server;
}

// 2. НАСТРОЙКА КЛИЕНТА (используя старый API ClientSubscription.create и событие "changed" на monitoredItem)
async function startClient(server) {
    // Ждём немного, чтобы сервер запустился
    await new Promise(resolve => setTimeout(resolve, 2000));

    const client = opcua.OPCUAClient.create({
        endpointMustExist: false
    });

    await client.connect(endpointUrl);
    const session = await client.createSession();

    // Используем старый API: ClientSubscription.create
    const subscription = opcua.ClientSubscription.create(session, {
        requestedPublishingInterval: 100,  // Интервал публикации подписки
        requestedLifetimeCount: 60000,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 1000,  // Добавлено для полноты
        publishingEnabled: true,
        priority: 1
    });

    // Параметры мониторинга: samplingInterval 100 мс, DataChangeFilter с deadband 10 (Absolute)
    // ИСПРАВЛЕНИЕ: Создаём экземпляр DataChangeFilter как ExtensionObject
    const dataChangeFilter = new opcua.DataChangeFilter({
        trigger: opcua.DataChangeTrigger.StatusValue,  // Триггер на значение и статус
        deadbandType: opcua.DeadbandType.Absolute,  // Абсолютный deadband
        deadbandValue: 10  // Уведомление только при изменении >10
    });

    const monitoringParameters = {
        samplingInterval: 100,  // 100 мс семплинг
        discardOldest: true,
        queueSize: 10,
        filter: dataChangeFilter  // Теперь это экземпляр ExtensionObject
    };

    // Создаём monitored item (в старом API: subscription.monitor)
    const monitoredItem = await subscription.monitor(
        {
            nodeId: nodeId,
            attributeId: opcua.AttributeIds.Value
        },
        monitoringParameters,
        opcua.TimestampsToReturn.Both
    );

    // Обработчик изменений: используем "changed" на monitoredItem (ИСПРАВЛЕНИЕ: только dataValue как аргумент)
    monitoredItem.on("changed", (dataValue) => {  // Убрали monitorItem — событие emits только dataValue
        // Здесь можно добавить connectionManager.updateKeepAlive(); если у вас есть connectionManager
        // handleDataChange(monitorItem, dataValue);  // Если у вас есть handleDataChange

        // Для примера: логируем значение (dataValue.value.value — для Variant внутри DataValue)
        console.log("Client: Received data change:");
        console.log(`  Value: ${dataValue.value.value} (at ${dataValue.serverTimestamp.toISOString()})`);
    });

    // Обработка ошибок
    monitoredItem.on("error", (err) => console.error("MonitoredItem error:", err));
    subscription.on("error", (err) => console.error("Subscription error:", err));

    console.log("Client subscribed with deadband 10 - expect notifications every ~1s (10 changes)");
    return { client, session, subscription, monitoredItem };
}

// 3. ГЛАВНАЯ ФУНКЦИЯ: Запуск сервера и клиента
async function main() {
    try {
        const server = await startServer();

        // Ждём 30 секунд для демонстрации, затем остановка
        const { client, session, subscription, monitoredItem } = await startClient(server);

        setTimeout(async () => {
            console.log("\nShutting down...");
            monitoredItem.terminate();
            await subscription.delete();  // В старом API: subscription.delete()
            await session.close();
            await client.disconnect();
            await server.shutdown();
            process.exit(0);
        }, 30000);  // 30 секунд работы

    } catch (err) {
        console.error("Error:", err);
    }
}

main();